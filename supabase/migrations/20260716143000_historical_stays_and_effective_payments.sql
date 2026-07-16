-- Estancias históricas sin inventario y abonos append-only con fecha efectiva CDMX.

alter table public.reservations
  add column if not exists is_historical boolean not null default false;

create index if not exists idx_reservations_historical
  on public.reservations (is_historical)
  where is_historical;

alter table public.payments
  add column if not exists effective_date date,
  add column if not exists captured_at timestamptz,
  add column if not exists shift_id uuid references public.shifts(id) on delete set null,
  add column if not exists balance_after numeric(10,2);

drop trigger if exists payments_append_only on public.payments;

update public.payments
set
  effective_date = coalesce(effective_date, (received_at at time zone 'America/Mexico_City')::date),
  captured_at = coalesce(captured_at, received_at)
where effective_date is null or captured_at is null;

with running as (
  select
    p.id,
    greatest(
      0,
      f.total_amount - sum(p.amount) over (
        partition by p.folio_id
        order by coalesce(p.captured_at, p.received_at), p.id
        rows between unbounded preceding and current row
      )
    )::numeric(10,2) as calculated_balance
  from public.payments p
  join public.folios f on f.id = p.folio_id
)
update public.payments p
set balance_after = running.calculated_balance
from running
where running.id = p.id
  and p.balance_after is null;

alter table public.payments
  alter column effective_date set default ((now() at time zone 'America/Mexico_City')::date),
  alter column effective_date set not null,
  alter column captured_at set default now(),
  alter column captured_at set not null;

comment on column public.payments.effective_date is
  'Fecha contable en que se recibió el pago, interpretada en America/Mexico_City.';
comment on column public.payments.captured_at is
  'Timestamp inmutable en que el personal capturó el abono en el sistema.';
comment on column public.payments.received_at is
  'Timestamp efectivo conservado por compatibilidad; captured_at es la fecha de captura.';

create index if not exists idx_payments_effective_date
  on public.payments (effective_date);
create index if not exists idx_payments_folio_captured
  on public.payments (folio_id, captured_at, id);
create index if not exists idx_payments_shift_id
  on public.payments (shift_id);

create or replace function public.prevent_payment_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Los pagos son append-only; registre un nuevo abono o ajuste compensatorio.'
    using errcode = '55000';
end;
$$;

drop trigger if exists payments_append_only on public.payments;
create trigger payments_append_only
before update or delete on public.payments
for each row execute function public.prevent_payment_mutation();

drop policy if exists "ops_payments_access" on public.payments;
drop policy if exists "ops_payments_read" on public.payments;
create policy "ops_payments_read"
on public.payments for select
using (public.current_role() in ('admin', 'reception'));

create or replace function public.register_folio_payment(
  p_folio_id uuid,
  p_amount numeric,
  p_method public.payment_method,
  p_effective_date date,
  p_notes text default null,
  p_admin_override boolean default false,
  p_override_reason text default null
)
returns table (
  payment_id uuid,
  folio_code text,
  paid_amount numeric,
  expected_total numeric,
  balance_due numeric,
  payment_status public.payment_status,
  payment_type public.payment_type
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_folio public.folios%rowtype;
  v_expected numeric(10,2);
  v_paid numeric(10,2);
  v_balance numeric(10,2);
  v_status public.payment_status;
  v_type public.payment_type;
  v_payment_id uuid;
  v_shift_id uuid;
  v_is_historical boolean;
begin
  select * into v_actor
  from public.profiles
  where id = auth.uid();

  if v_actor.id is null or v_actor.role::text not in ('admin', 'reception') then
    raise exception 'No tienes permiso para registrar cobros.' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero.' using errcode = '22023';
  end if;
  if p_effective_date is null or p_effective_date > (now() at time zone 'America/Mexico_City')::date then
    raise exception 'La fecha efectiva no puede estar en el futuro.' using errcode = '22023';
  end if;

  select * into v_folio
  from public.folios
  where id = p_folio_id
  for update;
  if v_folio.id is null then
    raise exception 'No se encontró el folio.' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.reservations r
    where r.folio_id = p_folio_id and r.is_historical
  ) into v_is_historical;

  if v_is_historical then
    v_expected := v_folio.total_amount;
  else
    select coalesce(sum(
      coalesce(rg.final_rate, 0) * greatest(r.nights, 0) + coalesce(rg.locker_amount, 0)
    ), 0)
    into v_expected
    from public.reservations r
    left join public.reservation_guests rg on rg.reservation_id = r.id
    where r.folio_id = p_folio_id;

    select v_expected + coalesce(sum(fes.amount), 0)
    into v_expected
    from public.folio_extra_services fes
    where fes.folio_id = p_folio_id;
  end if;

  v_expected := round(coalesce(v_expected, v_folio.total_amount), 2);
  select round(coalesce(sum(p.amount), 0) + p_amount, 2)
  into v_paid
  from public.payments p
  where p.folio_id = p_folio_id;

  if v_paid > v_expected then
    if not (v_actor.role::text = 'admin' and p_admin_override and nullif(btrim(p_override_reason), '') is not null) then
      raise exception 'El monto excede el saldo permitido. Máximo: $%.',
        to_char(greatest(0, v_expected - v_folio.paid_amount), 'FM999999990.00')
        using errcode = '22023';
    end if;
  end if;

  v_balance := greatest(0, round(v_expected - v_paid, 2));
  v_status := case when v_balance = 0 then 'liquidated'::public.payment_status
                   else 'partial'::public.payment_status end;
  v_type := case when v_status = 'liquidated' then 'settlement'::public.payment_type
                 else 'advance'::public.payment_type end;

  select s.id into v_shift_id
  from public.shifts s
  where s.status = 'open'
    and s.opened_by = v_actor.id
  order by s.opened_at desc
  limit 1
  for update;

  if v_actor.role::text = 'reception' and v_shift_id is null then
    raise exception 'Inicia tu propio turno antes de registrar cobros.' using errcode = '55000';
  end if;

  insert into public.payments (
    folio_id, amount, method, payment_type, received_by, received_at,
    effective_date, captured_at, shift_id, balance_after, notes
  ) values (
    p_folio_id, p_amount, p_method, v_type, v_actor.id,
    (p_effective_date + time '12:00') at time zone 'America/Mexico_City',
    p_effective_date, now(), v_shift_id, v_balance, nullif(btrim(p_notes), '')
  )
  returning id into v_payment_id;

  update public.folios
  set total_amount = v_expected,
      paid_amount = v_paid,
      balance_due = v_balance,
      payment_status = v_status
  where id = p_folio_id;

  if v_status = 'liquidated' then
    update public.reservations
    set status = 'confirmed'
    where folio_id = p_folio_id
      and checked_out_at is null
      and status not in ('cancelled', 'checked_out');
  end if;

  insert into public.audit_logs (
    actor_user_id, actor_role, action, entity_type, entity_id, metadata
  ) values (
    v_actor.id, v_actor.role::public.user_role, 'payment_registered', 'folio', p_folio_id,
    jsonb_build_object(
      'payment_id', v_payment_id,
      'folio_code', v_folio.folio_code,
      'amount', p_amount,
      'method', p_method,
      'effective_date', p_effective_date,
      'captured_at', now(),
      'shift_id', v_shift_id,
      'paid_amount', v_paid,
      'balance_due', v_balance,
      'expected_total', v_expected,
      'admin_override', p_admin_override,
      'override_reason', nullif(btrim(p_override_reason), '')
    )
  );

  return query select
    v_payment_id,
    v_folio.folio_code,
    v_paid,
    v_expected,
    v_balance,
    v_status,
    v_type;
end;
$$;

create or replace function public.create_historical_stay(
  p_folio_code text,
  p_check_in_date date,
  p_check_out_date date,
  p_total_amount numeric,
  p_guests jsonb,
  p_notes text default null,
  p_initial_payment numeric default 0,
  p_payment_method public.payment_method default 'cash',
  p_effective_date date default null,
  p_payment_notes text default null
)
returns table (reservation_id uuid, folio_id uuid, folio_code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_folio_id uuid;
  v_reservation_id uuid;
  v_guest jsonb;
  v_guest_id uuid;
  v_nights integer;
  v_paid numeric(10,2);
  v_balance numeric(10,2);
  v_status public.payment_status;
  v_shift_id uuid;
  v_payment_id uuid;
  v_normalized_phone text;
  v_match_decision text;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if v_actor.id is null or v_actor.role::text <> 'admin' then
    raise exception 'Solo administración puede capturar estancias históricas.' using errcode = '42501';
  end if;
  if nullif(btrim(p_folio_code), '') is null then
    raise exception 'El folio histórico es obligatorio.' using errcode = '22023';
  end if;
  if p_check_in_date is null or p_check_out_date is null
     or p_check_out_date <= p_check_in_date
     or p_check_out_date > (now() at time zone 'America/Mexico_City')::date then
    raise exception 'La estancia debe tener fechas pasadas válidas y salida posterior a entrada.'
      using errcode = '22023';
  end if;
  if p_total_amount is null or p_total_amount < 0 then
    raise exception 'El total no puede ser negativo.' using errcode = '22023';
  end if;
  if p_initial_payment is null or p_initial_payment < 0 or p_initial_payment > p_total_amount then
    raise exception 'El pago inicial debe estar entre cero y el total.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_guests) <> 'array' or jsonb_array_length(p_guests) = 0 then
    raise exception 'Se requiere al menos un huésped.' using errcode = '22023';
  end if;

  v_nights := p_check_out_date - p_check_in_date;
  v_paid := round(p_initial_payment, 2);
  v_balance := round(p_total_amount - v_paid, 2);
  v_status := case when v_balance = 0 then 'liquidated'::public.payment_status
                   when v_paid > 0 then 'partial'::public.payment_status
                   else 'pending'::public.payment_status end;

  insert into public.folios (folio_code, total_amount, paid_amount, balance_due, payment_status)
  values (upper(btrim(p_folio_code)), p_total_amount, v_paid, v_balance, v_status)
  returning id into v_folio_id;

  insert into public.reservations (
    folio_id, created_by, check_in_date, check_out_date, check_in_at, check_out_at,
    checked_out_at, checked_out_by, nights, status, notes, reservation_source, is_historical
  ) values (
    v_folio_id, v_actor.id, p_check_in_date, p_check_out_date,
    (p_check_in_date + time '15:00') at time zone 'America/Mexico_City',
    (p_check_out_date + time '12:00') at time zone 'America/Mexico_City',
    (p_check_out_date + time '12:00') at time zone 'America/Mexico_City',
    v_actor.id, v_nights, 'checked_out', nullif(btrim(p_notes), ''), 'cashier_counter', true
  )
  returning id into v_reservation_id;

  for v_guest in select value from jsonb_array_elements(p_guests)
  loop
    if nullif(btrim(v_guest->>'full_name'), '') is null then
      raise exception 'Todos los huéspedes requieren nombre.' using errcode = '22023';
    end if;
    v_normalized_phone :=
      nullif(regexp_replace(coalesce(v_guest->>'phone', ''), '\D', '', 'g'), '');
    v_match_decision := nullif(v_guest->>'match_decision', '');
    if v_normalized_phone is not null and char_length(v_normalized_phone) <> 10 then
      raise exception 'Los teléfonos históricos deben tener 10 dígitos.'
        using errcode = '22023';
    end if;

    if v_match_decision = 'reuse' then
      if nullif(v_guest->>'guest_id', '') is null then
        raise exception 'Falta el huésped seleccionado para reutilizar.' using errcode = '22023';
      end if;

      select g.id into v_guest_id
      from public.guests g
      where g.id = (v_guest->>'guest_id')::uuid
        and (
          v_normalized_phone is null
          or g.normalized_phone = v_normalized_phone
        );

      if v_guest_id is null then
        raise exception 'La coincidencia del huésped cambió; vuelve a buscar el teléfono.'
          using errcode = '22023';
      end if;
    else
      if v_normalized_phone is not null
         and v_match_decision is distinct from 'create_new'
         and exists (
           select 1 from public.guests g
           where g.normalized_phone = v_normalized_phone
         ) then
        raise exception 'Ya existe un huésped con ese teléfono; elige reutilizarlo o crear uno nuevo.'
          using errcode = '22023';
      end if;

      insert into public.guests (
        full_name, phone, email, normalized_name, normalized_phone, sex
      ) values (
        btrim(v_guest->>'full_name'),
        nullif(btrim(v_guest->>'phone'), ''),
        nullif(lower(btrim(v_guest->>'email')), ''),
        lower(btrim(v_guest->>'full_name')),
        v_normalized_phone,
        case when v_guest->>'sex' in ('f','m','x','unknown')
          then (v_guest->>'sex')::public.guest_sex else 'unknown'::public.guest_sex end
      )
      returning id into v_guest_id;
    end if;

    insert into public.reservation_guests (
      reservation_id, guest_id, bed_id, nightly_rate, discount_amount,
      final_rate, social_bonus_status
    ) values (
      v_reservation_id, v_guest_id, null, 0, 0, 0, 'historical'
    );
  end loop;

  if v_paid > 0 then
    if p_effective_date is null or p_effective_date > (now() at time zone 'America/Mexico_City')::date then
      raise exception 'La fecha efectiva del pago es obligatoria y no puede ser futura.' using errcode = '22023';
    end if;
    -- La captura histórica administrativa no se atribuye a un turno operativo.
    v_shift_id := null;

    insert into public.payments (
      folio_id, amount, method, payment_type, received_by, received_at,
      effective_date, captured_at, shift_id, balance_after, notes
    ) values (
      v_folio_id, v_paid, p_payment_method,
      case when v_balance = 0 then 'settlement'::public.payment_type else 'advance'::public.payment_type end,
      v_actor.id,
      (p_effective_date + time '12:00') at time zone 'America/Mexico_City',
      p_effective_date, now(), v_shift_id, v_balance, nullif(btrim(p_payment_notes), '')
    )
    returning id into v_payment_id;

    insert into public.audit_logs (
      actor_user_id, actor_role, action, entity_type, entity_id, metadata
    ) values (
      v_actor.id, v_actor.role::public.user_role, 'payment_registered', 'folio', v_folio_id,
      jsonb_build_object(
        'payment_id', v_payment_id,
        'folio_code', upper(btrim(p_folio_code)),
        'amount', v_paid,
        'method', p_payment_method,
        'effective_date', p_effective_date,
        'captured_at', now(),
        'shift_id', v_shift_id,
        'paid_amount', v_paid,
        'balance_due', v_balance,
        'historical_capture', true
      )
    );
  end if;

  insert into public.audit_logs (
    actor_user_id, actor_role, action, entity_type, entity_id, metadata
  ) values (
    v_actor.id, v_actor.role::public.user_role, 'historical_stay_created', 'reservation', v_reservation_id,
    jsonb_build_object(
      'folio_id', v_folio_id,
      'folio_code', upper(btrim(p_folio_code)),
      'check_in_date', p_check_in_date,
      'check_out_date', p_check_out_date,
      'total_amount', p_total_amount,
      'initial_payment', v_paid,
      'payment_id', v_payment_id,
      'inventory_blocked', false
    )
  );

  return query select v_reservation_id, v_folio_id, upper(btrim(p_folio_code));
end;
$$;

revoke all on function public.register_folio_payment(uuid,numeric,public.payment_method,date,text,boolean,text) from public;
grant execute on function public.register_folio_payment(uuid,numeric,public.payment_method,date,text,boolean,text) to authenticated;
revoke all on function public.create_historical_stay(text,date,date,numeric,jsonb,text,numeric,public.payment_method,date,text) from public;
grant execute on function public.create_historical_stay(text,date,date,numeric,jsonb,text,numeric,public.payment_method,date,text) to authenticated;
