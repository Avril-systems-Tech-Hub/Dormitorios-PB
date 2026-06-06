-- ============================================================
-- RBAC: Roles dinámicos con módulos asignables
-- ============================================================

-- 1. Tabla de roles del sistema
create table if not exists public.system_roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  label text not null,
  is_system boolean not null default false,  -- true para roles que no se pueden eliminar (admin)
  created_at timestamptz not null default now()
);

-- 2. Tabla de módulos del sistema
create table if not exists public.system_modules (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,        -- "dashboard", "reservations", "expenses", etc.
  label text not null,             -- "Resumen", "Reservas", "Gastos", etc.
  href text not null,              -- "/dashboard", "/dashboard/reservations", etc.
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 3. Permisos: qué módulos tiene asignado cada rol
create table if not exists public.role_module_permissions (
  role_id uuid not null references public.system_roles(id) on delete cascade,
  module_id uuid not null references public.system_modules(id) on delete cascade,
  primary key (role_id, module_id)
);

-- 4. Agregar FK a profiles hacia system_roles
alter table public.profiles
  add column if not exists system_role_id uuid references public.system_roles(id);

-- 5. Habilitar RLS en nuevas tablas
alter table public.system_roles enable row level security;
alter table public.system_modules enable row level security;
alter table public.role_module_permissions enable row level security;

-- 6. Políticas: solo admin puede gestionar roles y permisos
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

-- 7. Seed: roles del sistema
insert into public.system_roles (name, label, is_system) values
  ('admin', 'Administrador', true),
  ('reception', 'Recepción', false)
on conflict (name) do nothing;

-- 8. Seed: módulos del sistema (en orden de aparición en sidebar)
insert into public.system_modules (key, label, href, sort_order) values
  ('dashboard', 'Resumen', '/dashboard', 1),
  ('reservations', 'Reservas', '/dashboard/reservations', 2),
  ('folios', 'Folios', '/dashboard/folios', 3),
  ('beds', 'Camas', '/dashboard/beds', 4),
  ('guests', 'Huéspedes', '/dashboard/guests', 5),
  ('payments', 'Pagos', '/dashboard/payments', 6),
  ('expenses', 'Gastos', '/dashboard/expenses', 7),
  ('imported_records', 'Importados', '/dashboard/imported-records', 8),
  ('shifts', 'Turnos', '/dashboard/shifts', 9),
  ('cash_cuts', 'Cortes', '/dashboard/cash-cuts', 10),
  ('audit', 'Auditoría', '/dashboard/audit', 11),
  ('users', 'Usuarios', '/dashboard/users', 12),
  ('settings', 'Ajustes', '/dashboard/settings', 13)
on conflict (key) do nothing;

-- 9. Seed: permisos por defecto
-- Admin: todos los módulos
insert into public.role_module_permissions (role_id, module_id)
select sr.id, sm.id
from public.system_roles sr
cross join public.system_modules sm
where sr.name = 'admin'
on conflict do nothing;

-- Reception: módulos que tenía antes + pagos, turnos, cortes
insert into public.role_module_permissions (role_id, module_id)
select sr.id, sm.id
from public.system_roles sr
cross join public.system_modules sm
where sr.name = 'reception'
  and sm.key in ('dashboard', 'reservations', 'folios', 'beds', 'guests', 'payments', 'expenses', 'shifts', 'cash_cuts')
on conflict do nothing;

-- 10. Migrar profiles existentes: asignar system_role_id basado en el campo role
update public.profiles p
set system_role_id = sr.id
from public.system_roles sr
where sr.name = p.role::text
  and p.system_role_id is null;