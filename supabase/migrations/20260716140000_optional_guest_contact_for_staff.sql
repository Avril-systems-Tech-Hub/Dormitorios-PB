-- Staff-created reservations may register guests without contact details.
-- Public reservation validation remains enforced in the server action.

alter table public.guests
  alter column phone drop not null,
  alter column normalized_phone drop not null;

update public.guests
set
  phone = nullif(btrim(phone), ''),
  normalized_phone = nullif(btrim(normalized_phone), '')
where
  phone is distinct from nullif(btrim(phone), '')
  or normalized_phone is distinct from nullif(btrim(normalized_phone), '');

comment on column public.guests.phone is
  'Nullable for authenticated admin/reception flows; public reservations require a valid phone.';

comment on column public.guests.normalized_phone is
  'Nullable when phone is absent. Never use NULL/empty values for guest identity matching.';
