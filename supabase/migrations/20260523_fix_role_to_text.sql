-- 1. Cambiar profiles.role de enum user_role a text
alter table public.profiles
  alter column role type text using role::text;

-- 2. Eliminar función con CASCADE (elimina todas las políticas dependientes automáticamente)
drop function if exists public.current_role() cascade;

-- 3. Recrear la función current_role() con retorno text
create function public.current_role()
returns text as $$
  select role from public.profiles where id = auth.uid()
$$ language sql stable;

-- 4. Recrear todas las políticas RLS
create policy "profiles_self_or_admin"
on public.profiles for select
using (id = auth.uid() or public.current_role() = 'admin');

create policy "profiles_admin_update"
on public.profiles for all
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

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

create policy "ops_cash_movements_access"
on public.cash_movements for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));

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

create policy "admin_system_roles_access"
on public.system_roles for all
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

create policy "admin_system_modules_access"
on public.system_modules for all
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

create policy "admin_role_module_permissions_access"
on public.role_module_permissions for all
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');
