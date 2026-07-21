-- Admin-only hard delete for mistaken expenses.
-- If the movement belongs to a shift with an existing cash cut, rebuild that
-- cut from the remaining ledger rows in the same transaction.

create or replace function public.admin_delete_expense(p_movement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_movement public.cash_movements%rowtype;
  v_cut public.cash_cuts%rowtype;
  v_total_cash numeric(10,2) := 0;
  v_total_transfer numeric(10,2) := 0;
  v_total_card numeric(10,2) := 0;
  v_movement_income numeric(10,2) := 0;
  v_total_expenses numeric(10,2) := 0;
  v_total_guest_income numeric(10,2) := 0;
  v_net_result numeric(10,2) := 0;
  v_difference numeric(10,2) := 0;
begin
  select * into v_actor
  from public.profiles
  where id = auth.uid();

  if v_actor.id is null or v_actor.role::text <> 'admin' then
    raise exception 'Solo un administrador puede eliminar egresos.'
      using errcode = '42501';
  end if;
  if p_movement_id is null then
    raise exception 'Egreso no especificado.' using errcode = '22023';
  end if;

  select * into v_movement
  from public.cash_movements
  where id = p_movement_id
    and direction = 'expense'
  for update;

  if v_movement.id is null then
    raise exception 'Egreso no encontrado.' using errcode = 'P0002';
  end if;

  if v_movement.shift_id is not null then
    select * into v_cut
    from public.cash_cuts
    where shift_id = v_movement.shift_id
    for update;
  end if;

  delete from public.cash_movements
  where id = v_movement.id;

  if v_cut.id is not null then
    select
      coalesce(sum(amount) filter (where method = 'cash'), 0),
      coalesce(sum(amount) filter (where method = 'transfer'), 0),
      coalesce(sum(amount) filter (where method = 'card'), 0)
    into v_total_cash, v_total_transfer, v_total_card
    from public.payments
    where shift_id = v_movement.shift_id;

    select
      coalesce(sum(amount) filter (where direction = 'income'), 0),
      coalesce(sum(amount) filter (where direction = 'expense'), 0)
    into v_movement_income, v_total_expenses
    from public.cash_movements
    where shift_id = v_movement.shift_id;

    v_total_guest_income := round(v_total_cash + v_total_transfer + v_total_card, 2);
    v_net_result := round(v_total_guest_income + v_movement_income - v_total_expenses, 2);
    v_difference := 0;

    update public.cash_cuts
    set total_cash = v_total_cash,
        total_transfer = v_total_transfer,
        total_card = v_total_card,
        total_income = v_net_result,
        total_guest_income = v_total_guest_income,
        total_expenses = v_total_expenses,
        net_result = v_net_result,
        expected_income = v_net_result,
        actual_cash_counted = v_net_result,
        difference = v_difference,
        leakage_flag = false
    where id = v_cut.id;
  end if;

  insert into public.audit_logs (
    actor_user_id, actor_role, action, entity_type, entity_id, metadata
  ) values (
    v_actor.id,
    v_actor.role::public.user_role,
    'expense_deleted',
    'cash_movement',
    v_movement.id,
    jsonb_build_object(
      'movement_date', v_movement.movement_date,
      'recorded_at', v_movement.recorded_at,
      'responsible_profile_id', v_movement.responsible_profile_id,
      'shift_id', v_movement.shift_id,
      'expense_concept', v_movement.expense_concept,
      'concept_detail', v_movement.concept_detail,
      'amount', v_movement.amount,
      'method', v_movement.method,
      'notes', v_movement.notes,
      'receipt_image_path', v_movement.receipt_image_path,
      'cash_cut_recalculated', v_cut.id is not null,
      'cash_cut_id', v_cut.id
    )
  );

  return jsonb_build_object(
    'movement_id', v_movement.id,
    'amount', v_movement.amount,
    'expense_concept', v_movement.expense_concept,
    'receipt_image_path', v_movement.receipt_image_path,
    'cash_cut_recalculated', v_cut.id is not null
  );
end;
$$;

revoke all on function public.admin_delete_expense(uuid) from public;
grant execute on function public.admin_delete_expense(uuid) to authenticated;

comment on function public.admin_delete_expense(uuid) is
  'Admin-only hard delete of an expense with transactional cash-cut recalculation.';
