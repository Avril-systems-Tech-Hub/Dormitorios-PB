-- Socio de consulta: ve operación, finanzas, turnos, auditoría y reportes.
-- No ve importados, ajustes, usuarios ni registrar concepto.
-- is_system: no se puede borrar ni cambiarle los módulos desde el panel.

insert into public.system_roles (name, label, is_system)
values ('consulta', 'Consulta', true)
on conflict (name) do update
set label = excluded.label,
    is_system = true;

delete from public.role_module_permissions
where role_id = (select id from public.system_roles where name = 'consulta');

insert into public.role_module_permissions (role_id, module_id)
select sr.id, sm.id
from public.system_roles sr
cross join public.system_modules sm
where sr.name = 'consulta'
  and sm.key in (
    'dashboard',
    'reservations',
    'beds',
    'guests',
    'payments',
    'expenses',
    'shifts',
    'cash_cuts',
    'reports',
    'audit'
  )
on conflict do nothing;
