-- Reception may capture already-finished stays from the guests dashboard.
-- These records remain historical: no bed assignment and no inventory blocking.

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
  if v_actor.id is null or v_actor.role::text not in ('admin', 'reception') then
    raise exception 'Solo administración y recepción pueden capturar estancias históricas.'
      using errcode = '42501';
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
    -- Historical capture is not attributed to the receptionist's current shift.
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

revoke all on function public.create_historical_stay(
  text,date,date,numeric,jsonb,text,numeric,public.payment_method,date,text
) from public;
grant execute on function public.create_historical_stay(
  text,date,date,numeric,jsonb,text,numeric,public.payment_method,date,text
) to authenticated;

comment on function public.create_historical_stay(
  text,date,date,numeric,jsonb,text,numeric,public.payment_method,date,text
) is 'Creates a finished historical stay; available to admin and reception.';
