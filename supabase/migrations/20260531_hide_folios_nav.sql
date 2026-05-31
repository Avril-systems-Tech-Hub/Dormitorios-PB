-- Folio info consolidated on Huéspedes; remove Folios from dashboard nav and RBAC assignments.

delete from public.role_module_permissions
where module_id in (select id from public.system_modules where key = 'folios');

delete from public.system_modules
where key = 'folios';
