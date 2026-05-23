-- Agregar columna is_disabled a profiles para deshabilitar usuarios sin eliminarlos
alter table public.profiles
  add column if not exists is_disabled boolean not null default false;

-- Índice para consultas rápidas
create index if not exists idx_profiles_is_disabled on public.profiles (is_disabled) where is_disabled = true;