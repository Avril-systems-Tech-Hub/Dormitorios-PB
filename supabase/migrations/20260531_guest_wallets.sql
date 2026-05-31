-- Guest wallet linking for WaaP (Celo / EVM addresses)
create type public.wallet_chain as enum ('celo');

create table if not exists public.guest_wallets (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests(id) on delete cascade,
  chain public.wallet_chain not null default 'celo',
  address text not null,
  is_primary boolean not null default true,
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint guest_wallets_chain_address_unique unique (chain, address)
);

create index if not exists idx_guest_wallets_guest_id on public.guest_wallets(guest_id);
create index if not exists idx_guest_wallets_address_lower on public.guest_wallets (lower(address));

alter table public.guest_wallets enable row level security;

drop policy if exists "staff_guest_wallets_access" on public.guest_wallets;
create policy "staff_guest_wallets_access"
on public.guest_wallets for all
using (public.current_role() in ('admin', 'reception'))
with check (public.current_role() in ('admin', 'reception'));
