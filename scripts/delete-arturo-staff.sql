-- One-shot: finish removing Arturo Robledo staff account blocked by payment history.
-- Run in Supabase Dashboard → SQL Editor (production project yhwcwmkuhefzbtilcmoo).

create or replace function public.prevent_payment_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and new.received_by is null
    and old.received_by is not null
    and new.folio_id is not distinct from old.folio_id
    and new.amount is not distinct from old.amount
    and new.method is not distinct from old.method
    and new.payment_type is not distinct from old.payment_type
    and new.received_at is not distinct from old.received_at
    and new.notes is not distinct from old.notes
    and new.effective_date is not distinct from old.effective_date
    and new.captured_at is not distinct from old.captured_at
    and new.shift_id is not distinct from old.shift_id
    and new.balance_after is not distinct from old.balance_after
    and new.is_reversal is not distinct from old.is_reversal
    and new.reversal_of_payment_id is not distinct from old.reversal_of_payment_id
    and new.reversal_reason is not distinct from old.reversal_reason
    and new.submission_id is not distinct from old.submission_id
  then
    return new;
  end if;

  raise exception 'Los pagos son append-only; registre un nuevo abono o ajuste compensatorio.'
    using errcode = '55000';
end;
$$;

do $$
declare
  v_user_id uuid := 'd9287338-5a02-4808-bcd8-1336659bbcbe';
begin
  update public.shifts set opened_by = null where opened_by = v_user_id;
  update public.shifts set closed_by = null where closed_by = v_user_id;
  update public.payments set received_by = null where received_by = v_user_id;
  update public.reservations set created_by = null where created_by = v_user_id;
  update public.reservations set checked_out_by = null where checked_out_by = v_user_id;
  update public.cash_cuts set generated_by = null where generated_by = v_user_id;
  update public.audit_logs set actor_user_id = null where actor_user_id = v_user_id;
  update public.cash_movements set responsible_profile_id = null where responsible_profile_id = v_user_id;

  delete from auth.users where id = v_user_id;
end
$$;
