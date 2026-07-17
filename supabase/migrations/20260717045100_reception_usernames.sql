alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (
    username is null
    or (
      username = lower(username)
      and username ~ '^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$'
    )
  );

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;
