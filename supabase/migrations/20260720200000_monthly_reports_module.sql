-- Admin-only monthly operational reports.

do $$
begin
  if not exists (
    select 1 from public.system_modules where key = 'reports'
  ) then
    update public.system_modules
    set sort_order = sort_order + 1
    where sort_order > 10;

    insert into public.system_modules (key, label, href, sort_order)
    values ('reports', 'Reportes', '/dashboard/reports', 11);
  else
    update public.system_modules
    set label = 'Reportes',
        href = '/dashboard/reports',
        sort_order = 11
    where key = 'reports';
  end if;
end
$$;

insert into public.role_module_permissions (role_id, module_id)
select role.id, module.id
from public.system_roles role
cross join public.system_modules module
where role.name = 'admin'
  and module.key = 'reports'
on conflict do nothing;
