-- Real floor layout: Mixta 1a–15c (45) + Mujeres 1a–7c (21) = 66 beds.
-- bed_number becomes the bunk label (1a, 1b, …); zone disambiguates duplicates.

create type public.bed_zone as enum ('mixta', 'mujeres');

alter table public.beds
  add column if not exists zone public.bed_zone,
  add column if not exists sort_order integer;

-- Release FKs so inventory can be rebuilt against the real layout.
update public.reservation_guests
set bed_id = null
where bed_id is not null;

delete from public.beds;

alter table public.beds
  alter column bed_number type text
  using bed_number::text;

alter table public.beds
  drop constraint if exists beds_bed_number_key;

-- Rebuild inventory: Mixta then Mujeres; each bunk number has levels a/b/c.
with inventory as (
  select *
  from (
    select
      'mixta'::public.bed_zone as zone,
      n::text || letter as bed_number,
      ((n - 1) * 3) + letter_ord as sort_order
    from generate_series(1, 15) as n
    cross join (
      values ('a', 1), ('b', 2), ('c', 3)
    ) as levels(letter, letter_ord)

    union all

    select
      'mujeres'::public.bed_zone,
      n::text || letter,
      45 + ((n - 1) * 3) + letter_ord
    from generate_series(1, 7) as n
    cross join (
      values ('a', 1), ('b', 2), ('c', 3)
    ) as levels(letter, letter_ord)
  ) rows
)
insert into public.beds (bed_number, zone, sort_order, status)
select bed_number, zone, sort_order, 'available'::public.bed_status
from inventory
order by sort_order;

alter table public.beds
  alter column zone set not null,
  alter column sort_order set not null;

alter table public.beds
  add constraint beds_zone_bed_number_key unique (zone, bed_number);

create index if not exists idx_beds_zone_sort on public.beds (zone, sort_order);

-- RPC returns text bunk labels (zone shown in app layer).
-- Must drop first: return type changes from integer → text.
drop function if exists public.reassign_reservation_guest_bed(uuid, uuid, uuid);

create or replace function public.reassign_reservation_guest_bed(
  p_reservation_id uuid,
  p_guest_id uuid,
  p_bed_id uuid
)
returns table (old_bed_number text, new_bed_number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_reservation public.reservations%rowtype;
  v_assignment public.reservation_guests%rowtype;
  v_bed public.beds%rowtype;
  v_old_bed_number text;
begin
  select role::text into v_actor_role
  from public.profiles
  where id = auth.uid();

  if v_actor_role is null or v_actor_role not in ('admin', 'reception') then
    raise exception 'No tienes permiso para asignar camas.' using errcode = '42501';
  end if;

  select * into v_reservation
  from public.reservations
  where id = p_reservation_id
  for update;

  if v_reservation.id is null then
    raise exception 'Reservación no encontrada.' using errcode = 'P0002';
  end if;
  if v_reservation.checked_out_at is not null
     or v_reservation.status in ('cancelled', 'checked_out') then
    raise exception 'La estancia ya está cerrada y conserva su cama como historial.'
      using errcode = '55000';
  end if;

  select * into v_bed
  from public.beds
  where id = p_bed_id
  for update;

  if v_bed.id is null then
    raise exception 'Cama no encontrada.' using errcode = 'P0002';
  end if;
  if v_bed.status::text = 'blocked' then
    raise exception 'La cama seleccionada no está disponible.' using errcode = '55000';
  end if;

  select * into v_assignment
  from public.reservation_guests
  where reservation_id = p_reservation_id
    and guest_id = p_guest_id
  for update;

  if v_assignment.id is null then
    raise exception 'Huésped no encontrado en la reservación.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.reservation_guests rg
    join public.reservations r on r.id = rg.reservation_id
    where rg.bed_id = p_bed_id
      and rg.id <> v_assignment.id
      and r.checked_out_at is null
      and r.status not in ('cancelled', 'checked_out')
      and r.check_in_date < v_reservation.check_out_date
      and v_reservation.check_in_date < r.check_out_date
  ) then
    raise exception 'La cama % ya está ocupada en esas fechas.', v_bed.bed_number
      using errcode = '23P01';
  end if;

  select bed_number into v_old_bed_number
  from public.beds
  where id = v_assignment.bed_id;

  update public.reservation_guests
  set bed_id = p_bed_id
  where id = v_assignment.id;

  return query select v_old_bed_number, v_bed.bed_number;
end;
$$;

revoke all on function public.reassign_reservation_guest_bed(uuid,uuid,uuid) from public;
grant execute on function public.reassign_reservation_guest_bed(uuid,uuid,uuid) to authenticated;
