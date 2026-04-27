create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'reception');
create type public.bed_status as enum ('available', 'blocked');
create type public.payment_status as enum ('pending', 'partial', 'liquidated');
create type public.payment_method as enum ('cash', 'transfer', 'card');
create type public.payment_type as enum ('advance', 'settlement', 'extra');
create type public.shift_status as enum ('open', 'closed');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'reception',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  normalized_name text not null,
  normalized_phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.beds (
  id uuid primary key default gen_random_uuid(),
  bed_number integer not null unique,
  status public.bed_status not null default 'available',
  notes text
);

create table if not exists public.folios (
  id uuid primary key default gen_random_uuid(),
  folio_code text not null unique,
  total_amount numeric(10,2) not null default 0,
  paid_amount numeric(10,2) not null default 0,
  balance_due numeric(10,2) not null default 0,
  payment_status public.payment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  folio_id uuid not null references public.folios(id) on delete cascade,
  created_by uuid references public.profiles(id),
  check_in_date date not null,
  check_out_date date not null,
  nights integer not null check (nights > 0),
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.reservation_guests (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete restrict,
  bed_id uuid not null references public.beds(id) on delete restrict,
  nightly_rate numeric(10,2) not null default 120,
  discount_amount numeric(10,2) not null default 0,
  final_rate numeric(10,2) not null default 120,
  social_bonus_status text not null default 'none'
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  folio_id uuid not null references public.folios(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  method public.payment_method not null,
  payment_type public.payment_type not null,
  received_by uuid references public.profiles(id),
  received_at timestamptz not null default now(),
  notes text
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid references public.profiles(id),
  closed_by uuid references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  status public.shift_status not null default 'open'
);

create table if not exists public.cash_cuts (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  generated_by uuid references public.profiles(id),
  total_cash numeric(10,2) not null default 0,
  total_transfer numeric(10,2) not null default 0,
  total_card numeric(10,2) not null default 0,
  total_income numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id),
  actor_role public.user_role,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.promotion_claims (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references public.guests(id),
  reservation_id uuid references public.reservations(id),
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references public.guests(id),
  reservation_id uuid references public.reservations(id),
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute procedure public.handle_updated_at();

drop trigger if exists guests_updated_at on public.guests;
create trigger guests_updated_at
before update on public.guests
for each row execute procedure public.handle_updated_at();

alter table public.profiles enable row level security;
alter table public.guests enable row level security;
alter table public.beds enable row level security;
alter table public.folios enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_guests enable row level security;
alter table public.payments enable row level security;
alter table public.shifts enable row level security;
alter table public.cash_cuts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.promotion_claims enable row level security;
alter table public.whatsapp_messages enable row level security;

create or replace function public.current_role()
returns public.user_role as $$
  select role from public.profiles where id = auth.uid()
$$ language sql stable;

create policy "profiles_self_or_admin"
on public.profiles for select
using (id = auth.uid() or public.current_role() = 'admin');

create policy "profiles_admin_update"
on public.profiles for all
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

create policy "ops_select_all"
on public.guests for select
using (auth.uid() is not null);
create policy "ops_modify_guests"
on public.guests for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create policy "ops_beds_access"
on public.beds for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create policy "ops_folios_access"
on public.folios for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create policy "ops_reservations_access"
on public.reservations for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create policy "ops_reservation_guests_access"
on public.reservation_guests for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create policy "ops_payments_access"
on public.payments for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create policy "ops_shifts_access"
on public.shifts for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create policy "ops_cash_cuts_access"
on public.cash_cuts for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create policy "admin_audit_access"
on public.audit_logs for all
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

create policy "ops_promotion_claims_access"
on public.promotion_claims for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create policy "ops_whatsapp_messages_access"
on public.whatsapp_messages for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create type public.guest_sex as enum ('f', 'm', 'x', 'unknown');
create type public.cash_movement_direction as enum ('income', 'expense');
create type public.cash_movement_category as enum (
  'sale',
  'gasto_operativo',
  'gasto_administrativo',
  'gasto_cubrir_dias',
  'contadora',
  'other'
);
create type public.whatsapp_status as enum ('queued', 'sent', 'failed');
create type public.reservation_source as enum ('guest_app', 'cashier_counter');

alter table public.guests
  add column if not exists client_external_id text,
  add column if not exists sex public.guest_sex not null default 'unknown';

alter table public.reservations
  add column if not exists check_in_at timestamptz,
  add column if not exists check_out_at timestamptz,
  add column if not exists reservation_source public.reservation_source not null default 'guest_app';

alter table public.reservation_guests
  add column if not exists locker_number integer,
  add column if not exists locker_price numeric(10,2) not null default 0,
  add column if not exists locker_days integer not null default 0,
  add column if not exists locker_amount numeric(10,2) not null default 0;

alter table public.whatsapp_messages
  add column if not exists folio_id uuid references public.folios(id) on delete set null,
  add column if not exists phone text,
  add column if not exists delivered_at timestamptz,
  add column if not exists error_message text;

alter table public.whatsapp_messages
  alter column status drop default;

update public.whatsapp_messages
set status = case
  when lower(status) in ('queued', 'sent', 'failed') then lower(status)
  else 'queued'
end
where status is not null;

alter table public.whatsapp_messages
  alter column status type public.whatsapp_status
  using (
    case
      when status is null then 'queued'::public.whatsapp_status
      else status::public.whatsapp_status
    end
  );

alter table public.whatsapp_messages
  alter column status set default 'queued'::public.whatsapp_status;

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  movement_date date not null default current_date,
  recorded_at timestamptz not null default now(),
  responsible_profile_id uuid references public.profiles(id),
  direction public.cash_movement_direction not null,
  category public.cash_movement_category not null default 'other',
  amount numeric(10,2) not null check (amount > 0),
  method public.payment_method not null default 'cash',
  notes text
);

alter table public.cash_movements enable row level security;

create policy "ops_cash_movements_access"
on public.cash_movements for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create index if not exists idx_guests_normalized_phone on public.guests(normalized_phone);
create index if not exists idx_reservation_guests_reservation_id on public.reservation_guests(reservation_id);
create index if not exists idx_cash_movements_movement_date on public.cash_movements(movement_date);
create index if not exists idx_cash_movements_direction on public.cash_movements(direction);

create type public.import_batch_status as enum ('draft', 'previewed', 'imported', 'failed');
create type public.anomaly_flag as enum (
  'BED_AMOUNT_MISMATCH',
  'LOCKER_AMOUNT_MISMATCH',
  'TOTAL_MISMATCH',
  'EXTRA_SERVICE_REVIEW',
  'MISSING_TOTAL',
  'MISSING_BED',
  'INVALID_DATE_RANGE',
  'LOCKER_NUMBER_WITHOUT_CHARGE',
  'LOCKER_CHARGE_WITHOUT_LOCKER_NUMBER',
  'BED_OVERLAP_REVIEW',
  'LONG_STAY_REVIEW',
  'NEEDS_MANUAL_REVIEW',
  'UNREADABLE_FIELD',
  'MISSING_REQUIRED_FIELD'
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_name text,
  source_format text not null default 'tsv',
  uploaded_by uuid references public.profiles(id),
  status public.import_batch_status not null default 'draft',
  raw_content text,
  preview_count integer not null default 0,
  imported_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.imported_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  -- source columns captured as written on paper
  source_day text,
  source_name text,
  source_client_no text,
  source_sex text,
  source_bed text,
  source_locker text,
  source_check_in_date text,
  source_check_in_time text,
  source_check_out_date text,
  source_nights text,
  source_bed_price text,
  source_bed_amount text,
  source_locker_price text,
  source_locker_days text,
  source_locker_amount text,
  source_total text,
  -- normalized fields
  guest_name text,
  guest_sex public.guest_sex,
  bed_number integer,
  locker_number integer,
  check_in_date date,
  check_in_time time,
  check_out_date date,
  nights integer,
  bed_price numeric(10,2),
  locker_price numeric(10,2),
  locker_days integer,
  -- written amounts from paper
  bed_amount_written numeric(10,2),
  locker_amount_written numeric(10,2),
  total_written numeric(10,2),
  -- calculated values
  bed_amount_calculated numeric(10,2) not null default 0,
  locker_amount_calculated numeric(10,2) not null default 0,
  extra_services_total numeric(10,2) not null default 0,
  total_calculated numeric(10,2) not null default 0,
  -- deltas
  bed_amount_difference numeric(10,2) not null default 0,
  locker_amount_difference numeric(10,2) not null default 0,
  total_difference numeric(10,2) not null default 0,
  needs_review boolean not null default false,
  unreadable_fields text[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.imported_record_anomalies (
  id uuid primary key default gen_random_uuid(),
  imported_record_id uuid not null references public.imported_records(id) on delete cascade,
  flag public.anomaly_flag not null,
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.extra_services (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  amount numeric(10,2) not null check (amount >= 0),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.folio_extra_services (
  id uuid primary key default gen_random_uuid(),
  folio_id uuid not null references public.folios(id) on delete cascade,
  extra_service_id uuid references public.extra_services(id) on delete set null,
  service_name text not null,
  amount numeric(10,2) not null check (amount >= 0),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.imported_record_extra_services (
  id uuid primary key default gen_random_uuid(),
  imported_record_id uuid not null references public.imported_records(id) on delete cascade,
  extra_service_id uuid references public.extra_services(id) on delete set null,
  service_name text not null,
  amount numeric(10,2) not null check (amount >= 0),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.cash_cuts
  add column if not exists expected_income numeric(10,2) not null default 0,
  add column if not exists actual_cash_counted numeric(10,2),
  add column if not exists difference numeric(10,2) not null default 0,
  add column if not exists leakage_flag boolean not null default false;

drop trigger if exists import_batches_updated_at on public.import_batches;
create trigger import_batches_updated_at
before update on public.import_batches
for each row execute procedure public.handle_updated_at();

drop trigger if exists imported_records_updated_at on public.imported_records;
create trigger imported_records_updated_at
before update on public.imported_records
for each row execute procedure public.handle_updated_at();

alter table public.import_batches enable row level security;
alter table public.imported_records enable row level security;
alter table public.imported_record_anomalies enable row level security;
alter table public.extra_services enable row level security;
alter table public.folio_extra_services enable row level security;
alter table public.imported_record_extra_services enable row level security;

create policy "ops_import_batches_access"
on public.import_batches for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create policy "ops_imported_records_access"
on public.imported_records for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create policy "ops_imported_record_anomalies_access"
on public.imported_record_anomalies for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create policy "ops_extra_services_access"
on public.extra_services for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create policy "ops_folio_extra_services_access"
on public.folio_extra_services for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create policy "ops_imported_record_extra_services_access"
on public.imported_record_extra_services for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

create index if not exists idx_imported_records_batch_id on public.imported_records(batch_id);
create index if not exists idx_imported_records_needs_review on public.imported_records(needs_review);
create index if not exists idx_imported_records_check_in_date on public.imported_records(check_in_date);
create index if not exists idx_imported_records_bed_number on public.imported_records(bed_number);
create index if not exists idx_imported_record_anomalies_record_id on public.imported_record_anomalies(imported_record_id);
create index if not exists idx_folio_extra_services_folio_id on public.folio_extra_services(folio_id);
create index if not exists idx_reservations_source on public.reservations(reservation_source);
