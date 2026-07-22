-- Auto-calculate stay totals for current/finished modes from nights + lockers
-- (same formula as new). Payment remains a separate optional field.

create or replace function public.register_staff_stay(
  p_submission_id uuid,
  p_mode text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_existing public.stay_registration_submissions%rowtype;
  v_payload_hash text;
  v_today date := (now() at time zone 'America/Mexico_City')::date;
  v_check_in date;
  v_check_out date;
  v_nights integer;
  v_guest_count integer;
  v_guest jsonb;
  v_guest_id uuid;
  v_guest_ids uuid[] := '{}'::uuid[];
  v_reused_ids uuid[] := '{}'::uuid[];
  v_normalized_phone text;
  v_match_decision text;
  v_email text;
  v_sex text;
  v_bed_id uuid;
  v_bed_ids uuid[] := '{}'::uuid[];
  v_bed_count integer := 0;
  v_locked_bed_count integer := 0;
  v_locker_number text;
  v_locker_numbers text[] := '{}'::text[];
  v_locker_days integer;
  v_locker_total numeric(10,2) := 0;
  v_discount_percent numeric(5,2);
  v_nightly_rate numeric(10,2) := 120;
  v_discount_amount numeric(10,2) := 0;
  v_final_rate numeric(10,2) := 120;
  v_total numeric(10,2);
  v_payment numeric(10,2);
  v_payment_method public.payment_method;
  v_payment_date date;
  v_payment_type public.payment_type;
  v_payment_id uuid;
  v_shift_id uuid;
  v_balance numeric(10,2);
  v_payment_status public.payment_status;
  v_folio_id uuid;
  v_folio_code text;
  v_reservation_id uuid;
  v_result jsonb;
begin
  if p_submission_id is null then
    raise exception 'Falta el identificador de envío.' using errcode = '22023';
  end if;
  if p_mode not in ('new', 'current', 'finished') then
    raise exception 'Tipo de estancia no válido.' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Los datos de la estancia no son válidos.' using errcode = '22023';
  end if;

  select * into v_actor
  from public.profiles
  where id = auth.uid();

  if v_actor.id is null or v_actor.role::text not in ('admin', 'reception') then
    raise exception 'No tienes permiso para registrar estancias.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text, 0));
  v_payload_hash := md5(p_mode || ':' || p_payload::text);

  select * into v_existing
  from public.stay_registration_submissions
  where id = p_submission_id;

  if v_existing.id is not null then
    if v_existing.actor_user_id <> v_actor.id
       or v_existing.mode <> p_mode
       or v_existing.payload_hash <> v_payload_hash then
      raise exception 'Este envío ya fue utilizado con datos diferentes.' using errcode = '23505';
    end if;
    return v_existing.result;
  end if;

  begin
    v_check_in := (p_payload->>'check_in_date')::date;
    v_check_out := (p_payload->>'check_out_date')::date;
  exception when others then
    raise exception 'Las fechas de estancia no son válidas.' using errcode = '22023';
  end;

  if v_check_out <= v_check_in then
    raise exception 'La salida debe ser posterior a la entrada.' using errcode = '22023';
  end if;
  if p_mode = 'new' and v_check_in < v_today then
    raise exception 'Una nueva estancia debe iniciar hoy o después.' using errcode = '22023';
  end if;
  if p_mode = 'current' and not (v_check_in < v_today and v_check_out > v_today) then
    raise exception 'Una estancia en curso debe incluir el día de hoy.' using errcode = '22023';
  end if;
  if p_mode = 'finished' and v_check_out > v_today then
    raise exception 'Una estancia terminada no puede tener salida futura.' using errcode = '22023';
  end if;

  v_nights := v_check_out - v_check_in;
  if jsonb_typeof(p_payload->'guests') <> 'array' then
    raise exception 'La lista de huéspedes no es válida.' using errcode = '22023';
  end if;
  v_guest_count := jsonb_array_length(p_payload->'guests');
  if v_guest_count < 1 then
    raise exception 'Se requiere al menos un huésped.' using errcode = '22023';
  end if;

  begin
    v_discount_percent := round(coalesce((p_payload->>'discount_percent')::numeric, 0), 2);
    v_payment := round(coalesce((p_payload->>'payment_amount')::numeric, 0), 2);
  exception when others then
    raise exception 'Los montos no son válidos.' using errcode = '22023';
  end;
  if p_mode <> 'new' then
    v_discount_percent := 0;
  end if;
  if v_discount_percent < 0 or v_discount_percent > 100 then
    raise exception 'El descuento debe estar entre 0 y 100.' using errcode = '22023';
  end if;
  if v_payment < 0 then
    raise exception 'El pago no es válido.' using errcode = '22023';
  end if;

  if coalesce(p_payload->>'payment_method', '') not in ('cash', 'transfer', 'card') then
    raise exception 'El método de pago no es válido.' using errcode = '22023';
  end if;
  v_payment_method := (p_payload->>'payment_method')::public.payment_method;

  if v_payment > 0 then
    begin
      v_payment_date := (p_payload->>'payment_date')::date;
    exception when others then
      raise exception 'La fecha real del pago es obligatoria.' using errcode = '22023';
    end;
    if v_payment_date > v_today then
      raise exception 'La fecha del pago no puede ser futura.' using errcode = '22023';
    end if;
    if p_mode = 'new' and v_payment_date <> v_today then
      raise exception 'Un pago cobrado ahora debe registrarse con la fecha de hoy.'
        using errcode = '22023';
    end if;
  end if;

  -- Collect and validate all requested beds before writing any business rows.
  begin
    select
      coalesce(array_agg((guest->>'bed_id')::uuid order by (guest->>'bed_id')), '{}'::uuid[]),
      count(*)
    into v_bed_ids, v_bed_count
    from jsonb_array_elements(p_payload->'guests') guest
    where nullif(guest->>'bed_id', '') is not null;
  exception when others then
    raise exception 'Una cama seleccionada no es válida.' using errcode = '22023';
  end;

  if p_mode = 'finished' and v_bed_count > 0 then
    raise exception 'Una estancia terminada no puede bloquear camas.' using errcode = '22023';
  end if;
  if p_mode = 'current' and v_bed_count <> v_guest_count then
    raise exception 'Asigna una cama para cada huésped en curso.' using errcode = '22023';
  end if;
  if p_mode = 'new' and v_bed_count not in (0, v_guest_count) then
    raise exception 'Asigna todas las camas ahora o continúa sin asignarlas.' using errcode = '22023';
  end if;
  if p_mode = 'new' and v_payment > 0 and v_bed_count <> v_guest_count then
    raise exception 'Asigna todas las camas antes de registrar un cobro.'
      using errcode = '22023';
  end if;
  if v_bed_count <> (select count(distinct bed_id) from unnest(v_bed_ids) bed_id) then
    raise exception 'No puedes asignar la misma cama a dos huéspedes.' using errcode = '22023';
  end if;

  if v_bed_count > 0 then
    perform 1
    from public.beds
    where id = any(v_bed_ids)
    order by id
    for update;

    select count(*) into v_locked_bed_count
    from public.beds
    where id = any(v_bed_ids)
      and status::text <> 'blocked';

    if v_locked_bed_count <> v_bed_count then
      raise exception 'Una cama seleccionada no existe o está bloqueada.' using errcode = '55000';
    end if;

    if exists (
      select 1
      from public.reservation_guests rg
      join public.reservations r on r.id = rg.reservation_id
      where rg.bed_id = any(v_bed_ids)
        and r.checked_out_at is null
        and r.status not in ('cancelled', 'checked_out')
        and r.check_in_date < v_check_out
        and v_check_in < r.check_out_date
    ) then
      raise exception 'Una cama seleccionada ya está ocupada durante esas fechas.'
        using errcode = '23P01';
    end if;
  end if;

  -- Locker codes also behave as exclusive inventory over the stay range.
  -- Finished stays may record locker days for pricing, but never assign codes.
  select coalesce(
    array_agg(upper(btrim(guest->>'locker_number')))
      filter (where nullif(btrim(guest->>'locker_number'), '') is not null),
    '{}'::text[]
  )
  into v_locker_numbers
  from jsonb_array_elements(p_payload->'guests') guest;

  if cardinality(v_locker_numbers) <>
     (select count(distinct locker) from unnest(v_locker_numbers) locker) then
    raise exception 'No puedes asignar el mismo locker a dos huéspedes.' using errcode = '22023';
  end if;
  if p_mode = 'finished' and cardinality(v_locker_numbers) > 0 then
    raise exception 'Una estancia terminada no puede asignar lockers.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('locker:' || locker, 0))
  from unnest(v_locker_numbers) locker
  order by locker;
  if cardinality(v_locker_numbers) > 0 and exists (
    select 1
    from public.reservation_guests rg
    join public.reservations r on r.id = rg.reservation_id
    where upper(btrim(rg.locker_number)) = any(v_locker_numbers)
      and r.checked_out_at is null
      and r.status not in ('cancelled', 'checked_out')
      and r.check_in_date < v_check_out
      and v_check_in < r.check_out_date
  ) then
    raise exception 'Un locker seleccionado ya está ocupado durante esas fechas.'
      using errcode = '23P01';
  end if;

  v_discount_amount := round(v_nightly_rate * v_discount_percent / 100, 2);
  v_final_rate := v_nightly_rate - v_discount_amount;
  select coalesce(sum(
    greatest(0, least(v_nights, coalesce((guest->>'locker_days')::integer, 0))) * 30
  ), 0)
  into v_locker_total
  from jsonb_array_elements(p_payload->'guests') guest;
  v_total := round(v_final_rate * v_nights * v_guest_count + v_locker_total, 2);

  if v_payment > v_total then
    raise exception 'El pago no puede exceder el total de la estancia.' using errcode = '22023';
  end if;

  -- Folio is optional for imported stays (current/finished). If missing, assign
  -- IMP-... so the business can register without a paper folio. New stays keep FPB-.
  v_folio_code := upper(nullif(btrim(p_payload->>'folio_code'), ''));
  if v_folio_code is null then
    v_folio_code :=
      case when p_mode in ('current', 'finished') then 'IMP-' else 'FPB-' end
      || to_char(now() at time zone 'America/Mexico_City', 'YYYYMMDDHH24MISS')
      || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end if;

  v_balance := round(v_total - v_payment, 2);
  v_payment_status := case
    when v_payment <= 0 then 'pending'::public.payment_status
    when v_balance > 0 then 'partial'::public.payment_status
    else 'liquidated'::public.payment_status
  end;

  insert into public.folios (
    folio_code, total_amount, paid_amount, balance_due, payment_status
  ) values (
    v_folio_code, v_total, 0, v_total, 'pending'
  )
  returning id into v_folio_id;

  insert into public.reservations (
    folio_id, created_by, check_in_date, check_out_date, check_in_at, check_out_at,
    checked_out_at, checked_out_by, nights, status, notes, reservation_source,
    is_historical, registration_mode, discount_percent
  ) values (
    v_folio_id,
    v_actor.id,
    v_check_in,
    v_check_out,
    (v_check_in + time '15:00') at time zone 'America/Mexico_City',
    (v_check_out + time '12:00') at time zone 'America/Mexico_City',
    case when p_mode = 'finished'
      then (v_check_out + time '12:00') at time zone 'America/Mexico_City'
      else null end,
    case when p_mode = 'finished' then v_actor.id else null end,
    v_nights,
    case when p_mode = 'finished' then 'checked_out' else 'active' end,
    nullif(btrim(p_payload->>'notes'), ''),
    'cashier_counter',
    p_mode = 'finished',
    p_mode,
    v_discount_percent
  )
  returning id into v_reservation_id;

  for v_guest in select value from jsonb_array_elements(p_payload->'guests')
  loop
    if nullif(btrim(v_guest->>'full_name'), '') is null then
      raise exception 'Todos los huéspedes requieren nombre.' using errcode = '22023';
    end if;
    v_sex := coalesce(v_guest->>'sex', 'unknown');
    if v_sex not in ('f', 'm', 'x') then
      raise exception 'Selecciona el sexo de todos los huéspedes.' using errcode = '22023';
    end if;
    v_normalized_phone :=
      nullif(regexp_replace(coalesce(v_guest->>'phone', ''), '\D', '', 'g'), '');
    if v_normalized_phone is not null and char_length(v_normalized_phone) <> 10 then
      raise exception 'Los teléfonos deben tener 10 dígitos.' using errcode = '22023';
    end if;
    v_email := nullif(lower(btrim(v_guest->>'email')), '');
    if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'Un correo electrónico no es válido.' using errcode = '22023';
    end if;
    v_match_decision := nullif(v_guest->>'match_decision', '');

    if v_match_decision = 'reuse' then
      begin
        v_guest_id := (v_guest->>'existing_guest_id')::uuid;
      exception when others then
        raise exception 'El huésped seleccionado para reutilizar no es válido.' using errcode = '22023';
      end;
      select id, sex::text into v_guest_id, v_sex
      from public.guests
      where id = v_guest_id
        and normalized_phone is not distinct from v_normalized_phone;
      if v_guest_id is null then
        raise exception 'La coincidencia del huésped cambió; vuelve a buscarlo.'
          using errcode = '22023';
      end if;
      if v_guest_id = any(v_reused_ids) then
        raise exception 'El mismo huésped no puede aparecer dos veces en una estancia.'
          using errcode = '22023';
      end if;
      v_reused_ids := array_append(v_reused_ids, v_guest_id);
    else
      if v_normalized_phone is not null
         and v_match_decision is distinct from 'create_new'
         and exists (
           select 1 from public.guests where normalized_phone = v_normalized_phone
         ) then
        raise exception 'Ya existe un huésped con ese teléfono; confirma si deseas reutilizarlo.'
          using errcode = '22023';
      end if;

      insert into public.guests (
        full_name, phone, email, normalized_name, normalized_phone, sex
      ) values (
        btrim(v_guest->>'full_name'),
        nullif(btrim(v_guest->>'phone'), ''),
        v_email,
        lower(btrim(v_guest->>'full_name')),
        v_normalized_phone,
        v_sex::public.guest_sex
      )
      returning id into v_guest_id;
    end if;

    if p_mode in ('new', 'current') and exists (
      select 1
      from public.reservation_guests rg
      join public.reservations r on r.id = rg.reservation_id
      where rg.guest_id = v_guest_id
        and r.checked_out_at is null
        and r.status not in ('cancelled', 'checked_out')
        and r.check_in_date < v_check_out
        and v_check_in < r.check_out_date
    ) then
      raise exception 'Un huésped ya tiene otra estancia activa durante esas fechas.'
        using errcode = '23P01';
    end if;

    v_guest_ids := array_append(v_guest_ids, v_guest_id);
    v_bed_id := null;
    if nullif(v_guest->>'bed_id', '') is not null then
      v_bed_id := (v_guest->>'bed_id')::uuid;
      if exists (
        select 1 from public.beds
        where id = v_bed_id and zone::text = 'mujeres' and v_sex <> 'f'
      ) then
        raise exception 'La zona de Mujeres solo permite huéspedes registrados como femenino.'
          using errcode = '22023';
      end if;
    end if;

    v_locker_days := greatest(0, least(v_nights, coalesce((v_guest->>'locker_days')::integer, 0)));
    v_locker_number := case
      when p_mode = 'finished' then null
      when v_locker_days > 0 then upper(nullif(btrim(v_guest->>'locker_number'), ''))
      else null
    end;
    if p_mode = 'current' and v_locker_days > 0 and v_locker_number is null then
      raise exception 'Las estancias en curso requieren el código del locker utilizado.'
        using errcode = '22023';
    end if;

    insert into public.reservation_guests (
      reservation_id, guest_id, bed_id, nightly_rate, discount_amount, final_rate,
      locker_number, locker_price, locker_days, locker_amount, social_bonus_status
    ) values (
      v_reservation_id,
      v_guest_id,
      v_bed_id,
      v_nightly_rate,
      v_discount_amount,
      v_final_rate,
      v_locker_number,
      case when v_locker_days > 0 then 30 else 0 end,
      v_locker_days,
      v_locker_days * 30,
      case when p_mode = 'finished' then 'historical' else 'captured' end
    );
  end loop;

  if v_payment > 0 then
    v_shift_id := null;
    if p_mode = 'new' then
      select id into v_shift_id
      from public.shifts
      where status = 'open' and opened_by = v_actor.id
      order by opened_at desc
      limit 1
      for update;

      if v_actor.role::text = 'reception' and v_shift_id is null then
        raise exception 'Inicia tu propio turno antes de registrar un cobro.'
          using errcode = '55000';
      end if;
    end if;

    v_payment_type := case
      when v_balance = 0 then 'settlement'::public.payment_type
      else 'advance'::public.payment_type
    end;

    insert into public.payments (
      folio_id, amount, method, payment_type, received_by, received_at,
      effective_date, captured_at, shift_id, balance_after, notes, submission_id
    ) values (
      v_folio_id,
      v_payment,
      v_payment_method,
      v_payment_type,
      v_actor.id,
      (v_payment_date + time '12:00') at time zone 'America/Mexico_City',
      v_payment_date,
      now(),
      v_shift_id,
      v_balance,
      nullif(btrim(p_payload->>'payment_notes'), ''),
      p_submission_id
    )
    returning id into v_payment_id;
  end if;

  update public.folios
  set paid_amount = v_payment,
      balance_due = v_balance,
      payment_status = v_payment_status
  where id = v_folio_id;

  insert into public.audit_logs (
    actor_user_id, actor_role, action, entity_type, entity_id, metadata
  ) values (
    v_actor.id,
    v_actor.role::public.user_role,
    'staff_stay_registered',
    'reservation',
    v_reservation_id,
    jsonb_build_object(
      'submission_id', p_submission_id,
      'mode', p_mode,
      'folio_id', v_folio_id,
      'folio_code', v_folio_code,
      'check_in_date', v_check_in,
      'check_out_date', v_check_out,
      'guest_ids', to_jsonb(v_guest_ids),
      'bed_ids', to_jsonb(v_bed_ids),
      'total_amount', v_total,
      'payment_id', v_payment_id,
      'payment_amount', v_payment,
      'payment_effective_date', v_payment_date,
      'shift_id', v_shift_id,
      'imported_payment', p_mode in ('current', 'finished')
    )
  );

  v_result := jsonb_build_object(
    'reservation_id', v_reservation_id,
    'folio_id', v_folio_id,
    'folio_code', v_folio_code,
    'mode', p_mode
  );

  insert into public.stay_registration_submissions (
    id, actor_user_id, mode, payload_hash, reservation_id, folio_id, result
  ) values (
    p_submission_id, v_actor.id, p_mode, v_payload_hash,
    v_reservation_id, v_folio_id, v_result
  );

  return v_result;
end;
$$;

comment on function public.register_staff_stay(uuid,text,jsonb) is
  'Atomic and idempotent registration for new, current and finished staff stays with auto-calculated totals. Missing folio codes are assigned as FPB- (new) or IMP- (imported).';
