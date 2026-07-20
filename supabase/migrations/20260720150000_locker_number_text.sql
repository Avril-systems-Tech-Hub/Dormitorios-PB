-- Allow alphanumeric locker labels (e.g. A1, B12), not only integers.
alter table public.reservation_guests
  alter column locker_number type text
  using case
    when locker_number is null then null
    else locker_number::text
  end;
