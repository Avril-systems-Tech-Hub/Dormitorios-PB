-- Store the email used at WaaP login on the wallet link row.
alter table public.guest_wallets
  add column if not exists email text;

create index if not exists idx_guest_wallets_email_lower
  on public.guest_wallets (lower(email))
  where email is not null;
