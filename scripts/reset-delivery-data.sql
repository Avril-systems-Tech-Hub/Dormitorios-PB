-- ONE-TIME DELIVERY RESET — DORMITORIOS
--
-- This script deletes all test/operational data while preserving:
--   * auth.users and public.profiles (staff access)
--   * beds (physical inventory)
--   * system_roles, system_modules and role_module_permissions
--   * database schema, functions, policies and migration history
--
-- Before running:
--   1. Confirm the Supabase project URL/ref is the Dormitorios project.
--   2. Create and verify a database backup.
--   3. Review the staff accounts that must remain after delivery.
--   4. Change v_confirm from false to true below.
--
-- Do not add this file to supabase/migrations. It must only be run manually.

begin;

do $reset_guard$
declare
  v_confirm boolean := false;
  v_missing_tables text[];
begin
  if not v_confirm then
    raise exception
      'Delivery reset blocked. Verify the project and backup, then change v_confirm to true.';
  end if;

  select array_agg(expected_table)
  into v_missing_tables
  from unnest(array[
    'profiles',
    'guests',
    'beds',
    'folios',
    'reservations',
    'reservation_guests',
    'payments',
    'shifts',
    'cash_cuts',
    'cash_movements',
    'audit_logs',
    'system_roles',
    'system_modules'
  ]) as expected_table
  where to_regclass(format('public.%I', expected_table)) is null;

  if v_missing_tables is not null then
    raise exception
      'This does not look like the Dormitorios database. Missing tables: %',
      array_to_string(v_missing_tables, ', ');
  end if;

  if not exists (
    select 1
    from public.system_modules
    where key = 'guests' and href = '/dashboard/guests'
  ) then
    raise exception
      'Dormitorios module signature was not found. Reset cancelled.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where role = 'admin'
  ) then
    raise exception
      'No administrator profile exists. Create the client administrator before resetting.';
  end if;
end
$reset_guard$;

truncate table
  public.guest_wallets,
  public.promotion_claims,
  public.whatsapp_messages,
  public.reservation_guests,
  public.payments,
  public.folio_extra_services,
  public.reservations,
  public.folios,
  public.cash_cuts,
  public.cash_movements,
  public.shifts,
  public.imported_record_anomalies,
  public.imported_record_extra_services,
  public.imported_records,
  public.import_batches,
  public.audit_logs,
  public.guests,
  public.extra_services,
  public.promo_codes,
  public.discount_rules
restart identity cascade;

update public.beds
set status = 'available';

commit;

-- Expected result: every operational count is zero and all beds are available.
select
  (select count(*) from public.guests) as guests,
  (select count(*) from public.reservations) as reservations,
  (select count(*) from public.folios) as folios,
  (select count(*) from public.payments) as payments,
  (select count(*) from public.shifts) as shifts,
  (select count(*) from public.cash_movements) as cash_movements,
  (select count(*) from public.imported_records) as imported_records,
  (select count(*) from public.audit_logs) as audit_logs,
  (select count(*) from public.beds where status <> 'available') as unavailable_beds;
