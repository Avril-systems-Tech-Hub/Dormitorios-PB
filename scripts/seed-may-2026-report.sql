-- Fixture determinista para probar reportes mensuales de mayo de 2026.
-- USAR SOLO EN LOCAL O STAGING. Los pagos son append-only y este script no
-- incluye una limpieza destructiva.
--
-- Requisitos:
--   * migraciones aplicadas hasta 20260720190000;
--   * al menos un perfil admin;
--   * al menos 40 camas en la zona mixta.
--
-- El script es atómico: cualquier validación fallida revierte todo el lote.

begin;

do $seed$
declare
  v_admin_id uuid;
  v_day date;
  v_day_number integer;
  v_target integer;
  v_slot integer;
  v_bed_id uuid;
  v_guest_id uuid;
  v_folio_id uuid;
  v_reservation_id uuid;
  v_amount numeric(10,2) := 120;
  v_expense_amount numeric(10,2);
  v_expense_concept public.expense_concept;
begin
  if exists (
    select 1 from public.folios where folio_code like 'SIM-MAY26-%'
  ) or exists (
    select 1 from public.guests where client_external_id like 'SIM-MAY26-%'
  ) then
    raise exception
      'El lote SIM-MAY-2026 ya existe. No se insertó ningún registro.'
      using errcode = '23505';
  end if;

  select id
  into v_admin_id
  from public.profiles
  where role::text = 'admin'
  order by created_at, id
  limit 1;

  if v_admin_id is null then
    raise exception 'Se requiere al menos un perfil administrador.'
      using errcode = 'P0002';
  end if;

  if (
    select count(*)
    from public.beds
    where zone::text = 'mixta'
  ) < 40 then
    raise exception 'Se requieren al menos 40 camas en la zona mixta.'
      using errcode = 'P0002';
  end if;

  for v_slot in 1..40 loop
    insert into public.guests (
      full_name,
      phone,
      email,
      normalized_name,
      normalized_phone,
      client_external_id,
      sex,
      created_at,
      updated_at
    ) values (
      case when v_slot % 4 = 0
        then format('Simulación Mayo Mujer %s', lpad(v_slot::text, 3, '0'))
        else format('Simulación Mayo Hombre %s', lpad(v_slot::text, 3, '0'))
      end,
      '559260' || lpad(v_slot::text, 4, '0'),
      format('sim-may26-%s@example.invalid', lpad(v_slot::text, 3, '0')),
      case when v_slot % 4 = 0
        then format('simulacion mayo mujer %s', lpad(v_slot::text, 3, '0'))
        else format('simulacion mayo hombre %s', lpad(v_slot::text, 3, '0'))
      end,
      '559260' || lpad(v_slot::text, 4, '0'),
      format('SIM-MAY26-%s', lpad(v_slot::text, 3, '0')),
      case when v_slot % 4 = 0
        then 'f'::public.guest_sex
        else 'm'::public.guest_sex
      end,
      '2026-05-01 08:00:00-06'::timestamptz,
      '2026-05-01 08:00:00-06'::timestamptz
    );
  end loop;

  for v_day_number in 1..31 loop
    v_day := make_date(2026, 5, v_day_number);
    -- Secuencia reproducible de 30 a 40 camas ocupadas.
    v_target := 30 + ((v_day_number * 7) % 11);

    for v_slot in 1..v_target loop
      select id
      into v_bed_id
      from public.beds
      where zone::text = 'mixta'
      order by sort_order, id
      offset (v_slot - 1)
      limit 1;

      select id
      into v_guest_id
      from public.guests
      where client_external_id = format(
        'SIM-MAY26-%s',
        lpad(v_slot::text, 3, '0')
      );

      insert into public.folios (
        folio_code,
        total_amount,
        paid_amount,
        balance_due,
        payment_status,
        created_at
      ) values (
        format(
          'SIM-MAY26-%s-%s',
          to_char(v_day, 'YYYYMMDD'),
          lpad(v_slot::text, 2, '0')
        ),
        v_amount,
        0,
        v_amount,
        'pending'::public.payment_status,
        (v_day + time '08:00') at time zone 'America/Mexico_City'
      )
      returning id into v_folio_id;

      insert into public.reservations (
        folio_id,
        created_by,
        check_in_date,
        check_out_date,
        check_in_at,
        check_out_at,
        checked_out_at,
        checked_out_by,
        nights,
        status,
        notes,
        reservation_source,
        is_historical,
        registration_mode,
        discount_percent,
        created_at
      ) values (
        v_folio_id,
        v_admin_id,
        v_day,
        v_day + 1,
        (v_day + time '15:00') at time zone 'America/Mexico_City',
        (v_day + 1 + time '12:00') at time zone 'America/Mexico_City',
        (v_day + 1 + time '12:00') at time zone 'America/Mexico_City',
        v_admin_id,
        1,
        'checked_out',
        '[SIM-MAY-2026] Estancia sintética para reporte mensual',
        'cashier_counter'::public.reservation_source,
        false,
        'finished',
        0,
        (v_day + time '08:00') at time zone 'America/Mexico_City'
      )
      returning id into v_reservation_id;

      insert into public.reservation_guests (
        reservation_id,
        guest_id,
        bed_id,
        nightly_rate,
        discount_amount,
        final_rate,
        social_bonus_status,
        locker_number,
        locker_price,
        locker_days,
        locker_amount
      ) values (
        v_reservation_id,
        v_guest_id,
        v_bed_id,
        v_amount,
        0,
        v_amount,
        'simulation',
        null,
        0,
        0,
        0
      );

      insert into public.payments (
        folio_id,
        amount,
        method,
        payment_type,
        received_by,
        received_at,
        effective_date,
        captured_at,
        shift_id,
        balance_after,
        notes
      ) values (
        v_folio_id,
        v_amount,
        case
          when (v_day_number + v_slot) % 10 = 0
            then 'card'::public.payment_method
          when (v_day_number + v_slot) % 5 = 0
            then 'transfer'::public.payment_method
          else 'cash'::public.payment_method
        end,
        'settlement'::public.payment_type,
        v_admin_id,
        (v_day + time '18:00') at time zone 'America/Mexico_City',
        v_day,
        now(),
        null,
        0,
        '[SIM-MAY-2026] Pago sintético liquidado'
      );
    end loop;

    v_expense_amount := 300 + ((v_day_number * 137) % 1200);
    v_expense_concept := (
      array[
        'limpieza'::public.expense_concept,
        'lavanderia'::public.expense_concept,
        'papeleria'::public.expense_concept,
        'mantenimiento'::public.expense_concept,
        'agua'::public.expense_concept,
        'luz'::public.expense_concept,
        'gas'::public.expense_concept
      ]
    )[1 + ((v_day_number - 1) % 7)];

    insert into public.cash_movements (
      movement_date,
      recorded_at,
      responsible_profile_id,
      direction,
      category,
      amount,
      method,
      expense_concept,
      concept_detail,
      receipt_image_path,
      shift_id,
      notes
    ) values (
      v_day,
      (v_day + time '20:00') at time zone 'America/Mexico_City',
      v_admin_id,
      'expense'::public.cash_movement_direction,
      case when v_day_number % 6 = 0
        then 'gasto_administrativo'::public.cash_movement_category
        else 'gasto_operativo'::public.cash_movement_category
      end,
      v_expense_amount,
      'cash'::public.payment_method,
      v_expense_concept,
      '[SIM-MAY-2026] Gasto diario',
      null,
      null,
      '[SIM-MAY-2026] Movimiento sintético para reporte mensual'
    );
  end loop;

  insert into public.audit_logs (
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_admin_id,
    'admin'::public.user_role,
    'simulation_seeded',
    'monthly_report',
    null,
    jsonb_build_object(
      'batch', 'SIM-MAY-2026',
      'start_date', '2026-05-01',
      'end_date', '2026-05-31',
      'nightly_rate', v_amount
    )
  );
end
$seed$;

-- Ejecuta ahora el trigger diferido que recalcula cada folio.
set constraints all immediate;

do $validate$
declare
  v_bad_days integer;
  v_bad_rows integer;
begin
  with days as (
    select day::date
    from generate_series(
      '2026-05-01'::date,
      '2026-05-31'::date,
      interval '1 day'
    ) day
  ),
  occupancy as (
    select
      d.day,
      count(rg.id) as occupied
    from days d
    left join public.reservations r
      on r.check_in_date <= d.day
     and d.day < r.check_out_date
     and r.status <> 'cancelled'
    left join public.folios f
      on f.id = r.folio_id
     and f.folio_code like 'SIM-MAY26-%'
    left join public.reservation_guests rg
      on rg.reservation_id = r.id
     and f.id is not null
     and rg.bed_id is not null
    group by d.day
  )
  select count(*)
  into v_bad_days
  from occupancy
  where occupied not between 30 and 40;

  if v_bad_days > 0 then
    raise exception 'Validación fallida: % días fuera del rango 30–40.', v_bad_days;
  end if;

  with daily as (
    select
      r.check_in_date,
      count(rg.id) as assignments,
      count(distinct rg.bed_id) as beds,
      count(distinct rg.guest_id) as guests
    from public.reservations r
    join public.folios f on f.id = r.folio_id
    join public.reservation_guests rg on rg.reservation_id = r.id
    where f.folio_code like 'SIM-MAY26-%'
    group by r.check_in_date
  )
  select count(*)
  into v_bad_rows
  from daily
  where assignments <> beds or assignments <> guests;

  if v_bad_rows > 0 then
    raise exception 'Validación fallida: hay camas o huéspedes duplicados por día.';
  end if;

  select count(*)
  into v_bad_rows
  from public.reservations r
  join public.folios f on f.id = r.folio_id
  where f.folio_code like 'SIM-MAY26-%'
    and (
      r.nights <> 1
      or r.check_out_date <> r.check_in_date + 1
      or r.status <> 'checked_out'
      or r.checked_out_at is null
    );

  if v_bad_rows > 0 then
    raise exception 'Validación fallida: % estancias tienen ciclo inconsistente.', v_bad_rows;
  end if;

  select count(*)
  into v_bad_rows
  from public.folios
  where folio_code like 'SIM-MAY26-%'
    and (
      payment_status <> 'liquidated'
      or paid_amount <> total_amount
      or balance_due <> 0
    );

  if v_bad_rows > 0 then
    raise exception 'Validación fallida: % folios no quedaron liquidados.', v_bad_rows;
  end if;
end
$validate$;

-- Resumen visible en el editor SQL antes de confirmar el COMMIT.
select
  r.check_in_date as fecha,
  count(rg.id) as camas_ocupadas,
  count(*) filter (where g.sex = 'm') as hombres,
  count(*) filter (where g.sex = 'f') as mujeres,
  sum(p.amount) as ingresos,
  coalesce((
    select sum(cm.amount)
    from public.cash_movements cm
    where cm.movement_date = r.check_in_date
      and cm.direction = 'expense'
      and cm.notes like '[SIM-MAY-2026]%'
  ), 0) as egresos
from public.reservations r
join public.folios f on f.id = r.folio_id
join public.reservation_guests rg on rg.reservation_id = r.id
join public.guests g on g.id = rg.guest_id
join public.payments p on p.folio_id = f.id
where f.folio_code like 'SIM-MAY26-%'
group by r.check_in_date
order by r.check_in_date;

commit;
