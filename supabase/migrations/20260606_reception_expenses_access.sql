-- Reception: allow Egresos module (nav already groups it under Operación)
insert into public.role_module_permissions (role_id, module_id)
select sr.id, sm.id
from public.system_roles sr
cross join public.system_modules sm
where sr.name = 'reception'
  and sm.key = 'expenses'
on conflict do nothing;
