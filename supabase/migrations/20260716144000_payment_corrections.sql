-- Correcciones append-only de pagos. El pago original nunca se modifica:
-- cada corrección se registra como un movimiento negativo enlazado y auditado.

alter table public.payments
  add column if not exists is_reversal boolean not null default false,
  add column if not exists reversal_of_payment_id uuid references public.payments(id) on delete restrict,
  add column if not exists reversal_reason text,
  add column if not exists submission_id uuid;

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.payments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%amount > 0%'
  loop
    execute format('alter table public.payments drop constraint %I', v_constraint.conname);
  end loop;
end
$$;

alter table public.payments
  drop constraint if exists payments_signed_amount_check,
  add constraint payments_signed_amount_check check (
    (not is_reversal and amount > 0 and reversal_of_payment_id is null and reversal_reason is null)
    or
    (is_reversal and amount < 0 and reversal_of_payment_id is not null
      and nullif(btrim(reversal_reason), '') is not null)
  );

create unique index if not exists idx_payments_submission_id
  on public.payments (submission_id)
  where submission_id is not null;
create index if not exists idx_payments_reversal_of
  on public.payments (reversal_of_payment_id)
  where reversal_of_payment_id is not null;
create index if not exists idx_payments_shift_captured
  on public.payments (shift_id, captured_at, id);

comment on column public.payments.reversal_of_payment_id is
  'Pago positivo original compensado por este movimiento negativo.';
comment on column public.payments.reversal_reason is
  'Motivo obligatorio de la corrección; el movimiento original permanece intacto.';
comment on column public.payments.submission_id is
  'UUID idempotente generado por el cliente para evitar correcciones duplicadas.';

create or replace function public.refresh_folio_payment_summary()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_paid numeric(10,2);
  v_total numeric(10,2);
  v_balance numeric(10,2);
  v_status public.payment_status;
begin
  select greatest(0, round(coalesce(sum(amount), 0), 2))
  into v_paid
  from public.payments
  where folio_id = new.folio_id;

  select total_amount into v_total
  from public.folios
  where id = new.folio_id
  for update;

  v_balance := greatest(0, round(coalesce(v_total, 0) - v_paid, 2));
  v_status := case
    when v_paid <= 0 then 'pending'::public.payment_status
    when v_balance > 0 then 'partial'::public.payment_status
    else 'liquidated'::public.payment_status
  end;

  update public.folios
  set paid_amount = v_paid,
      balance_due = v_balance,
      payment_status = v_status
  where id = new.folio_id;
  return new;
end;
$$;

drop trigger if exists payments_refresh_folio_summary on public.payments;
create constraint trigger payments_refresh_folio_summary
after insert on public.payments
deferrable initially deferred
for each row execute function public.refresh_folio_payment_summary();

create or replace function public.reverse_folio_payment(
  p_payment_id uuid,
  p_amount numeric,
  p_reason text,
  p_submission_id uuid
)
returns table (
  correction_id uuid,
  folio_code text,
  corrected_amount numeric,
  paid_amount numeric,
  balance_due numeric,
  payment_status public.payment_status
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_original public.payments%rowtype;
  v_existing public.payments%rowtype;
  v_folio public.folios%rowtype;
  v_shift_id uuid;
  v_already_reversed numeric(10,2);
  v_net_paid numeric(10,2);
  v_balance numeric(10,2);
  v_status public.payment_status;
  v_correction_id uuid;
  v_today date := (now() at time zone 'America/Mexico_City')::date;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if v_actor.id is null or v_actor.role::text not in ('admin', 'reception') then
    raise exception 'No tienes permiso para corregir pagos.' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto a corregir debe ser mayor a cero.' using errcode = '22023';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'El motivo de la corrección es obligatorio.' using errcode = '22023';
  end if;
  if p_submission_id is null then
    raise exception 'Falta el identificador idempotente de la corrección.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text, 0));

  select * into v_existing
  from public.payments
  where submission_id = p_submission_id;
  if v_existing.id is not null then
    if not v_existing.is_reversal
       or v_existing.reversal_of_payment_id is distinct from p_payment_id
       or abs(v_existing.amount) is distinct from round(p_amount, 2)
       or v_existing.reversal_reason is distinct from btrim(p_reason) then
      raise exception 'Este envío ya fue procesado con datos diferentes.' using errcode = '23505';
    end if;

    select * into v_folio from public.folios where id = v_existing.folio_id;
    return query select
      v_existing.id,
      v_folio.folio_code,
      abs(v_existing.amount),
      v_folio.paid_amount,
      v_folio.balance_due,
      v_folio.payment_status;
    return;
  end if;

  select * into v_original
  from public.payments
  where id = p_payment_id
  for update;
  if v_original.id is null then
    raise exception 'No se encontró el pago original.' using errcode = 'P0002';
  end if;
  if v_original.is_reversal or v_original.amount <= 0 then
    raise exception 'Solo se puede corregir un pago positivo original.' using errcode = '22023';
  end if;

  select * into v_folio
  from public.folios
  where id = v_original.folio_id
  for update;

  select s.id into v_shift_id
  from public.shifts s
  where s.status = 'open'
    and s.opened_by = v_actor.id
  order by s.opened_at desc
  limit 1
  for update;
  if v_shift_id is null then
    raise exception 'Inicia tu propio turno antes de corregir pagos.' using errcode = '55000';
  end if;

  select coalesce(sum(abs(p.amount)), 0)
  into v_already_reversed
  from public.payments p
  where p.reversal_of_payment_id = v_original.id
    and p.is_reversal;

  if round(v_already_reversed + p_amount, 2) > v_original.amount then
    raise exception 'La corrección excede el monto disponible. Máximo: $%.',
      to_char(greatest(0, v_original.amount - v_already_reversed), 'FM999999990.00')
      using errcode = '22023';
  end if;

  select round(coalesce(sum(p.amount), 0) - p_amount, 2)
  into v_net_paid
  from public.payments p
  where p.folio_id = v_original.folio_id;

  v_net_paid := greatest(0, v_net_paid);
  v_balance := greatest(0, round(v_folio.total_amount - v_net_paid, 2));
  v_status := case
    when v_net_paid <= 0 then 'pending'::public.payment_status
    when v_balance > 0 then 'partial'::public.payment_status
    else 'liquidated'::public.payment_status
  end;

  insert into public.payments (
    folio_id, amount, method, payment_type, received_by, received_at,
    effective_date, captured_at, shift_id, balance_after, notes,
    is_reversal, reversal_of_payment_id, reversal_reason, submission_id
  ) values (
    v_original.folio_id, -round(p_amount, 2), v_original.method, v_original.payment_type,
    v_actor.id, now(), v_today, now(), v_shift_id, v_balance,
    'Corrección de pago: ' || btrim(p_reason),
    true, v_original.id, btrim(p_reason), p_submission_id
  )
  returning id into v_correction_id;

  update public.folios
  set paid_amount = v_net_paid,
      balance_due = v_balance,
      payment_status = v_status
  where id = v_original.folio_id;

  insert into public.audit_logs (
    actor_user_id, actor_role, action, entity_type, entity_id, metadata
  ) values (
    v_actor.id, v_actor.role::public.user_role, 'payment_reversed', 'payment', v_correction_id,
    jsonb_build_object(
      'original_payment_id', v_original.id,
      'correction_id', v_correction_id,
      'folio_id', v_original.folio_id,
      'folio_code', v_folio.folio_code,
      'corrected_amount', round(p_amount, 2),
      'reason', btrim(p_reason),
      'shift_id', v_shift_id,
      'paid_amount', v_net_paid,
      'balance_due', v_balance
    )
  );

  return query select
    v_correction_id,
    v_folio.folio_code,
    round(p_amount, 2),
    v_net_paid,
    v_balance,
    v_status;
end;
$$;

revoke all on function public.reverse_folio_payment(uuid,numeric,text,uuid) from public;
grant execute on function public.reverse_folio_payment(uuid,numeric,text,uuid) to authenticated;
