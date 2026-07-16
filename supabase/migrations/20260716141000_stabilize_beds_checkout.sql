-- Checkout real y reconciliación segura del inventario de camas.
-- La asignación en reservation_guests se conserva como historial; la ocupación
-- se deriva de fechas semiabiertas [check_in_date, check_out_date) y checkout real.

alter table public.reservations
  add column if not exists checked_out_at timestamptz,
  add column if not exists checked_out_by uuid references public.profiles(id) on delete set null;

comment on column public.reservations.checked_out_at is
  'Momento real en que recepción registró la salida; distinto del check_out_at programado.';
comment on column public.reservations.checked_out_by is
  'Perfil admin/reception que registró la salida real.';

create index if not exists idx_reservations_operational_checkout
  on public.reservations (check_in_date, check_out_date)
  where checked_out_at is null and status not in ('cancelled', 'checked_out');

-- Reconciliación idempotente: reconoce estados históricos inequívocos sin
-- borrar huéspedes, reservaciones, pagos ni asignaciones de cama.
update public.reservations
set
  status = 'checked_out',
  checked_out_at = coalesce(
    checked_out_at,
    check_out_at,
    (check_out_date + time '12:00') at time zone 'America/Mexico_City'
  )
where status in ('completed', 'complete', 'checkout', 'checked-out')
  and checked_out_at is null;

-- beds.status representa exclusivamente condición física. Convierte valores
-- heredados de ocupación a available cuando la columna aún era texto.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'beds'
      and column_name = 'status'
      and udt_name <> 'bed_status'
  ) then
    update public.beds
    set status = 'available'
    where status::text not in ('available', 'blocked');
  end if;
end
$$;

-- La cama se bloquea dentro de la misma transacción que valida el traslape.
-- El lock de la fila beds serializa asignaciones concurrentes a la misma cama.
create or replace function public.reassign_reservation_guest_bed(
  p_reservation_id uuid,
  p_guest_id uuid,
  p_bed_id uuid
)
returns table (old_bed_number integer, new_bed_number integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_reservation public.reservations%rowtype;
  v_assignment public.reservation_guests%rowtype;
  v_bed public.beds%rowtype;
  v_old_bed_number integer;
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
