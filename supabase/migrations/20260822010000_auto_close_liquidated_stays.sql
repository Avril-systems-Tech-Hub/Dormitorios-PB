-- Liquidated stays close themselves when the 11:00 CDMX period ends.
-- Amber "salida pendiente" is reserved for unpaid/partial folios (cash control).
-- checked_out_by stays null so a system close is distinct from a staff click.

create or replace function public.stay_period_end_at(p_check_out_date date)
returns timestamptz
language sql
immutable
parallel safe
as $$
  select ((p_check_out_date + time '11:00') at time zone 'America/Mexico_City');
$$;

comment on function public.stay_period_end_at(date) is
  'Instant when the bed frees: check-out calendar day at 11:00 America/Mexico_City.';

create or replace function public.auto_close_liquidated_stays()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  with closed as (
    update public.reservations r
    set
      status = 'checked_out',
      checked_out_at = public.stay_period_end_at(r.check_out_date)
    from public.folios f
    where f.id = r.folio_id
      and r.checked_out_at is null
      and r.status not in ('cancelled', 'checked_out')
      and f.payment_status = 'liquidated'
      and now() >= public.stay_period_end_at(r.check_out_date)
    returning r.id
  )
  select count(*)::integer into v_count from closed;

  return coalesce(v_count, 0);
end;
$$;

comment on function public.auto_close_liquidated_stays() is
  'Closes liquidated reservations whose 11:00 stay period has ended. Leaves unpaid/partial stays open for collection.';

revoke all on function public.stay_period_end_at(date) from public;
revoke all on function public.auto_close_liquidated_stays() from public;
grant execute on function public.stay_period_end_at(date) to authenticated, service_role;
grant execute on function public.auto_close_liquidated_stays() to authenticated, service_role;

create or replace function public.trg_auto_close_on_folio_liquidated()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.payment_status = 'liquidated'
     and old.payment_status is distinct from 'liquidated' then
    perform public.auto_close_liquidated_stays();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_close_on_folio_liquidated on public.folios;
create trigger trg_auto_close_on_folio_liquidated
after update of payment_status on public.folios
for each row
execute function public.trg_auto_close_on_folio_liquidated();

-- One-shot reconciliation of the existing amber backlog.
select public.auto_close_liquidated_stays();

notify pgrst, 'reload schema';
