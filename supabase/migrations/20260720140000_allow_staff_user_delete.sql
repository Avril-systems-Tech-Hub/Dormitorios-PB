-- Allow clearing payments.received_by when deleting staff accounts.
-- Payment amounts/methods remain append-only; only the staff pointer may be nulled.

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
