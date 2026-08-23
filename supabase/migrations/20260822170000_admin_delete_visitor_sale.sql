-- Admin-only hard delete for visitor shower/locker sales.
-- Recalculates the related cash cut so dormitory income stays accurate.

create or replace function public.admin_delete_visitor_sale(
  p_concept text,
  p_sale_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_concept text;
  v_sale_id uuid;
  v_visitor_name text;
  v_resource_number text;
  v_amount numeric(10,2);
  v_method public.payment_method;
  v_shift_id uuid;
  v_sold_at timestamptz;
  v_sold_date date;
  v_notes text;
  v_sold_by uuid;
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
    raise exception 'Solo un administrador puede eliminar cobros de invitados.'
      using errcode = '42501';
  end if;

  if p_sale_id is null then
    raise exception 'Cobro no especificado.' using errcode = '22023';
  end if;

  v_concept := lower(trim(p_concept));
  if v_concept not in ('shower', 'locker') then
    raise exception 'Concepto no válido.' using errcode = '22023';
  end if;

  if v_concept = 'shower' then
    select id, visitor_name, resource_number, amount, method, shift_id, sold_at, sold_date, notes, sold_by
    into v_sale_id, v_visitor_name, v_resource_number, v_amount, v_method, v_shift_id, v_sold_at, v_sold_date, v_notes, v_sold_by
    from public.visitor_shower_sales
    where id = p_sale_id
    for update;
  else
    select id, visitor_name, resource_number, amount, method, shift_id, sold_at, sold_date, notes, sold_by
    into v_sale_id, v_visitor_name, v_resource_number, v_amount, v_method, v_shift_id, v_sold_at, v_sold_date, v_notes, v_sold_by
    from public.visitor_locker_sales
    where id = p_sale_id
    for update;
  end if;

  if v_sale_id is null then
    raise exception 'Cobro de invitado no encontrado.' using errcode = 'P0002';
  end if;

  if v_concept = 'shower' then
    delete from public.visitor_shower_sales where id = v_sale_id;
  else
    delete from public.visitor_locker_sales where id = v_sale_id;
  end if;

  if v_shift_id is not null then
    select * into v_cut
    from public.cash_cuts
    where shift_id = v_shift_id
    for update;
  end if;

  if v_cut.id is not null then
    select s.total_cash, s.total_transfer, s.total_card
    into v_total_cash, v_total_transfer, v_total_card
    from public.shift_collected_by_method(v_shift_id) s;

    select
      coalesce(sum(amount) filter (where direction = 'income'), 0),
      coalesce(sum(amount) filter (where direction = 'expense'), 0)
    into v_movement_income, v_total_expenses
    from public.cash_movements
    where shift_id = v_shift_id;

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
    'visitor_sale_deleted',
    'visitor_sale',
    v_sale_id,
    jsonb_build_object(
      'concept', v_concept,
      'visitor_name', v_visitor_name,
      'resource_number', v_resource_number,
      'amount', v_amount,
      'method', v_method,
      'shift_id', v_shift_id,
      'sold_at', v_sold_at,
      'sold_date', v_sold_date,
      'notes', v_notes,
      'sold_by', v_sold_by,
      'cash_cut_recalculated', v_cut.id is not null,
      'cash_cut_id', v_cut.id
    )
  );

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'concept', v_concept,
    'amount', v_amount,
    'resource_number', v_resource_number,
    'cash_cut_recalculated', v_cut.id is not null
  );
end;
$$;

revoke all on function public.admin_delete_visitor_sale(text, uuid) from public;
grant execute on function public.admin_delete_visitor_sale(text, uuid) to authenticated;

comment on function public.admin_delete_visitor_sale(text, uuid) is
  'Hard-deletes a visitor shower/locker sale. Admin only. Recalculates the related cash cut.';

notify pgrst, 'reload schema';
