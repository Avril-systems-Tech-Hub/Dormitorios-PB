-- Hard-delete a guest from the dashboard (admin only).
-- Removes exclusive reservations/folios/payments so finance totals stay clean.
-- Blocks if the guest shares a reservation with another guest.
--
-- Payments remain append-only for normal ops; this path sets a transaction-local
-- flag that prevent_payment_mutation() honors only for DELETE.

create or replace function public.prevent_payment_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE'
    and current_setting('app.allow_payment_purge', true) = 'on'
  then
    return old;
  end if;

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

create or replace function public.admin_delete_guest(p_guest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_guest public.guests%rowtype;
  v_shared_count integer := 0;
  v_folio_ids uuid[];
  v_reservation_ids uuid[];
  v_payments_deleted integer := 0;
  v_batch integer := 0;
  v_folios_deleted integer := 0;
begin
  select * into v_actor
  from public.profiles
  where id = auth.uid();

  if v_actor.id is null or v_actor.role::text <> 'admin' then
    raise exception 'Solo un administrador puede eliminar huéspedes.' using errcode = '42501';
  end if;

  if p_guest_id is null then
    raise exception 'Huésped no especificado.' using errcode = '22023';
  end if;

  select * into v_guest
  from public.guests
  where id = p_guest_id
  for update;

  if v_guest.id is null then
    raise exception 'Huésped no encontrado.' using errcode = 'P0002';
  end if;

  select count(*)
  into v_shared_count
  from public.reservation_guests rg
  where rg.reservation_id in (
    select reservation_id from public.reservation_guests where guest_id = p_guest_id
  )
  and rg.guest_id <> p_guest_id;

  if v_shared_count > 0 then
    raise exception
      'Este huésped comparte una reservación con otra persona. Sepáralos antes de borrar.'
      using errcode = '55000';
  end if;

  select coalesce(array_agg(distinct r.id), '{}'::uuid[])
  into v_reservation_ids
  from public.reservations r
  join public.reservation_guests rg on rg.reservation_id = r.id
  where rg.guest_id = p_guest_id;

  select coalesce(array_agg(distinct r.folio_id), '{}'::uuid[])
  into v_folio_ids
  from public.reservations r
  where r.id = any(v_reservation_ids);

  update public.promotion_claims
  set guest_id = null
  where guest_id = p_guest_id;

  update public.whatsapp_messages
  set guest_id = null
  where guest_id = p_guest_id;

  if cardinality(v_folio_ids) > 0 then
    -- Transaction-local: only this function's DELETEs can purge payments.
    perform set_config('app.allow_payment_purge', 'on', true);

    delete from public.payments
    where folio_id = any(v_folio_ids)
      and is_reversal;
    get diagnostics v_batch = row_count;
    v_payments_deleted := v_payments_deleted + v_batch;

    delete from public.payments
    where folio_id = any(v_folio_ids);
    get diagnostics v_batch = row_count;
    v_payments_deleted := v_payments_deleted + v_batch;

    delete from public.folios
    where id = any(v_folio_ids);
    get diagnostics v_folios_deleted = row_count;
  end if;

  delete from public.reservation_guests
  where guest_id = p_guest_id;

  delete from public.guests
  where id = p_guest_id;

  insert into public.audit_logs (
    actor_user_id, actor_role, action, entity_type, entity_id, metadata
  ) values (
    v_actor.id,
    v_actor.role::public.user_role,
    'guest_deleted',
    'guest',
    p_guest_id,
    jsonb_build_object(
      'full_name', v_guest.full_name,
      'phone', v_guest.phone,
      'email', v_guest.email,
      'folio_ids', to_jsonb(v_folio_ids),
      'reservation_ids', to_jsonb(v_reservation_ids),
      'payments_deleted', v_payments_deleted,
      'folios_deleted', v_folios_deleted
    )
  );

  return jsonb_build_object(
    'guest_id', p_guest_id,
    'full_name', v_guest.full_name,
    'folios_deleted', cardinality(v_folio_ids),
    'reservations_deleted', cardinality(v_reservation_ids),
    'payments_deleted', v_payments_deleted
  );
end;
$$;

revoke all on function public.admin_delete_guest(uuid) from public;
grant execute on function public.admin_delete_guest(uuid) to authenticated;

comment on function public.admin_delete_guest(uuid) is
  'Admin-only hard delete of a guest and their exclusive stays/folios/payments.';
