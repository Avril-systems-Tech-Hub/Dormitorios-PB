-- Requiere al menos 2 usuarios en auth.users (admin y recepción).
-- Ajusta los emails en el CTE staff_users según tus cuentas reales.

-- Mixta 1a–15c (45) + Mujeres 1a–7c (21) = 66
with inventory as (
  select
    'mixta'::public.bed_zone as zone,
    n::text || letter as bed_number,
    ((n - 1) * 3) + letter_ord as sort_order
  from generate_series(1, 15) as n
  cross join (values ('a', 1), ('b', 2), ('c', 3)) as levels(letter, letter_ord)

  union all

  select
    'mujeres'::public.bed_zone,
    n::text || letter,
    45 + ((n - 1) * 3) + letter_ord
  from generate_series(1, 7) as n
  cross join (values ('a', 1), ('b', 2), ('c', 3)) as levels(letter, letter_ord)
)
insert into public.beds (bed_number, zone, sort_order, status, notes)
select
  bed_number,
  zone,
  sort_order,
  case
    when zone = 'mixta' and bed_number in ('3a', '7b', '12c') then 'blocked'::public.bed_status
    else 'available'::public.bed_status
  end,
  case
    when zone = 'mixta' and bed_number in ('3a', '7b', '12c') then 'Bloqueada por mantenimiento'
    else null
  end
from inventory
on conflict (zone, bed_number) do nothing;

with staff_users as (
  select id, email
  from auth.users
  where email in ('admin@dormitorios.local', 'recepcion@dormitorios.local')
  limit 2
)
insert into public.profiles (id, full_name, role)
select
  id,
  case when email like 'admin@%' then 'Administración Dormitorios' else 'Recepción Dormitorios' end,
  case when email like 'admin@%' then 'admin'::public.user_role else 'reception'::public.user_role end
from staff_users
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

insert into public.guests (full_name, phone, email, normalized_name, normalized_phone, client_external_id, sex)
values
('Juan Pérez', '5511111111', 'juan1@example.com', 'juan perez', '5511111111', 'CL-001', 'm'),
('María Gómez', '5511111112', 'maria2@example.com', 'maria gomez', '5511111112', 'CL-002', 'f'),
('Carlos Ruiz', '5511111113', 'carlos3@example.com', 'carlos ruiz', '5511111113', 'CL-003', 'm'),
('Luisa Torres', '5511111114', 'luisa4@example.com', 'luisa torres', '5511111114', 'CL-004', 'f'),
('Pedro Sánchez', '5511111115', 'pedro5@example.com', 'pedro sanchez', '5511111115', 'CL-005', 'm'),
('Ana López', '5511111116', 'ana6@example.com', 'ana lopez', '5511111116', 'CL-006', 'f'),
('Ricardo Vega', '5511111117', 'ricardo7@example.com', 'ricardo vega', '5511111117', 'CL-007', 'm'),
('Sofía Díaz', '5511111118', 'sofia8@example.com', 'sofia diaz', '5511111118', 'CL-008', 'f'),
('Miguel León', '5511111119', 'miguel9@example.com', 'miguel leon', '5511111119', 'CL-009', 'm'),
('Laura Salas', '5511111120', 'laura10@example.com', 'laura salas', '5511111120', 'CL-010', 'f'),
('Gabriela Cruz', '5511111121', 'gabriela11@example.com', 'gabriela cruz', '5511111121', 'CL-011', 'f'),
('Emilio Mora', '5511111122', 'emilio12@example.com', 'emilio mora', '5511111122', 'CL-012', 'm'),
('Paola Ríos', '5511111123', 'paola13@example.com', 'paola rios', '5511111123', 'CL-013', 'f'),
('David Ortiz', '5511111124', 'david14@example.com', 'david ortiz', '5511111124', 'CL-014', 'm'),
('Mónica Lara', '5511111125', 'monica15@example.com', 'monica lara', '5511111125', 'CL-015', 'f')
on conflict do nothing;

with creator as (
  select id from public.profiles order by role desc limit 1
),
guest_pool as (
  select id, row_number() over () as rn from public.guests order by created_at asc limit 15
),
bed_pool as (
  select id, row_number() over () as rn from public.beds where status = 'available' order by sort_order asc limit 20
),
folio_insert as (
  insert into public.folios (folio_code, total_amount, paid_amount, balance_due, payment_status)
  select
    format('FPB-%s', to_char(1000 + gs, 'FM0000')),
    120 * (1 + (gs % 3)),
    case when gs % 2 = 0 then 120 * (1 + (gs % 3)) else 120 end,
    case when gs % 2 = 0 then 0 else (120 * (1 + (gs % 3)) - 120) end,
    case when gs % 2 = 0 then 'liquidated'::public.payment_status else 'partial'::public.payment_status end
  from generate_series(1, 10) as gs
  on conflict (folio_code) do nothing
  returning id
),
folio_pool as (
  select id, row_number() over () as rn from public.folios where folio_code like 'FPB-%' order by created_at asc limit 10
),
reservation_insert as (
  insert into public.reservations (
    folio_id, created_by, check_in_date, check_out_date, check_in_at, check_out_at, nights, status, notes
  )
  select
    fp.id,
    c.id,
    current_date - ((fp.rn % 3)::int),
    current_date + ((fp.rn % 4 + 1)::int),
    (current_date - ((fp.rn % 3)::int))::timestamptz + interval '15:00',
    (current_date + ((fp.rn % 4 + 1)::int))::timestamptz + interval '12:00',
    (fp.rn % 4 + 1)::int,
    'active',
    'Reserva demo etapa 1'
  from folio_pool fp
  cross join creator c
  returning id, folio_id, row_number() over () as rn
),
reservation_guest_insert as (
  insert into public.reservation_guests (
    reservation_id, guest_id, bed_id, nightly_rate, discount_amount, final_rate, social_bonus_status, locker_number, locker_price, locker_days, locker_amount
  )
  select
    r.id,
    g.id,
    b.id,
    120,
    case when r.rn % 5 = 0 then 20 else 0 end,
    case when r.rn % 5 = 0 then 100 else 120 end,
    case when r.rn % 6 = 0 then 'eligible' else 'none' end,
    200 + r.rn,
    25,
    case when r.rn % 2 = 0 then 2 else 1 end,
    case when r.rn % 2 = 0 then 50 else 25 end
  from reservation_insert r
  join guest_pool g on g.rn = r.rn
  join bed_pool b on b.rn = r.rn
  returning id
),
payment_insert as (
  insert into public.payments (
    folio_id, amount, method, payment_type, received_by, notes
  )
  select
    fp.id,
    case when fp.rn % 2 = 0 then 240 else 120 end,
    case when fp.rn % 3 = 0 then 'card'::public.payment_method when fp.rn % 3 = 1 then 'cash'::public.payment_method else 'transfer'::public.payment_method end,
    case when fp.rn % 2 = 0 then 'settlement'::public.payment_type else 'advance'::public.payment_type end,
    c.id,
    'Pago demo etapa 1'
  from folio_pool fp
  cross join creator c
  returning id
),
shift_insert as (
  insert into public.shifts (opened_by, status)
  select c.id, 'open'::public.shift_status from creator c
  returning id
),
cash_cut_insert as (
  insert into public.cash_cuts (
    shift_id, generated_by, total_cash, total_transfer, total_card, total_income, notes
  )
  select s.id, c.id, 1320, 960, 1140, 3420, 'Corte demo de referencia'
  from shift_insert s
  cross join creator c
  returning id
)
insert into public.cash_movements (
  movement_date, recorded_at, responsible_profile_id, direction, category, amount, method, notes
)
select current_date, now() - interval '2 hour', c.id, 'income', 'sale', 1200, 'cash', 'Ventas mostrador'
from creator c
union all
select current_date, now() - interval '1 hour', c.id, 'expense', 'gasto_operativo', 180, 'cash', 'Limpieza y suministros'
from creator c;

insert into public.whatsapp_messages (
  guest_id, reservation_id, folio_id, status, phone, payload, delivered_at
)
select
  g.id,
  r.id,
  f.id,
  'sent',
  g.phone,
  jsonb_build_object('template', 'ticket_v1', 'folio', f.folio_code),
  now() - interval '10 minute'
from public.reservations r
join public.folios f on f.id = r.folio_id
join public.reservation_guests rg on rg.reservation_id = r.id
join public.guests g on g.id = rg.guest_id
limit 3;

insert into public.audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, metadata)
select c.id, 'admin'::public.user_role, 'seed_stage1', 'system', null, jsonb_build_object('source', 'seed_stage1.sql')
from creator c;
