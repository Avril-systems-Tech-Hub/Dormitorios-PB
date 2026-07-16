-- Aísla la operación por turno propio y evita cierres/cortes duplicados.

create unique index if not exists idx_shifts_one_open_per_user
  on public.shifts (opened_by)
  where status = 'open';

create unique index if not exists idx_cash_cuts_one_per_shift
  on public.cash_cuts (shift_id);

create index if not exists idx_cash_movements_shift_recorded
  on public.cash_movements (shift_id, recorded_at, id);

comment on index public.idx_cash_cuts_one_per_shift is
  'Cada turno operativo puede producir un solo corte.';
