-- Operational expense concepts (English enum values; Spanish labels in app UI)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'expense_concept') then
    create type public.expense_concept as enum (
      'sueldos',
      'lavanderia',
      'limpieza',
      'papeleria',
      'papel_bano',
      'basura',
      'medicamento',
      'jabon_bano',
      'gas',
      'mantenimiento',
      'internet',
      'agua',
      'luz',
      'cobijas',
      'extras'
    );
  end if;
end $$;

alter table public.cash_movements
  add column if not exists expense_concept public.expense_concept,
  add column if not exists concept_detail text,
  add column if not exists receipt_image_path text,
  add column if not exists shift_id uuid references public.shifts(id) on delete set null;

alter table public.cash_cuts
  add column if not exists total_guest_income numeric(10,2) not null default 0,
  add column if not exists total_expenses numeric(10,2) not null default 0,
  add column if not exists net_result numeric(10,2) not null default 0;

create index if not exists idx_cash_movements_expense_concept
  on public.cash_movements(expense_concept)
  where direction = 'expense';

create index if not exists idx_cash_movements_shift_id on public.cash_movements(shift_id);
