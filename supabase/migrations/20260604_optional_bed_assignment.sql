-- Camas y lockers se asignan en recepción después de crear la reservación.
alter table public.reservation_guests
  alter column bed_id drop not null;
