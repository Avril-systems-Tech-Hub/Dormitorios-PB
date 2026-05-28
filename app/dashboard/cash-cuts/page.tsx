import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import {
  createCashMovementAction,
  createDailyCashCutAction,
  createExpenseAction,
} from "@/actions/operations";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModulePermission } from "@/lib/auth/guards";
import { CashMovementForm } from "@/components/forms/cash-movement-form";
import { ExpenseCaptureForm } from "@/components/forms/expense-capture-form";
import { getExpenseConceptLabel } from "@/lib/expense-concepts";
import { parsePagination, getRange } from "@/lib/pagination";

export default async function CashCutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModulePermission("cash_cuts");
  const params = await searchParams;

  const cutsPag = parsePagination(params, "cuts");
  const movsPag = parsePagination(params, "movs");
  const [cutsFrom, cutsTo] = getRange(cutsPag.page, cutsPag.pageSize);
  const [movsFrom, movsTo] = getRange(movsPag.page, movsPag.pageSize);

  const supabase = createAdminClient();
  const { data: cashCuts, count: cutsCount } = await supabase
    .from("cash_cuts")
    .select(
      "id,total_cash,total_transfer,total_card,total_income,expected_income,actual_cash_counted,difference,leakage_flag,created_at,profiles:generated_by(full_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(cutsFrom, cutsTo);

  const { data: movements, count: movsCount } = await supabase
    .from("cash_movements")
    .select(
      "id,movement_date,direction,category,expense_concept,concept_detail,amount,notes,profiles:responsible_profile_id(full_name)",
      { count: "exact" },
    )
    .order("recorded_at", { ascending: false })
    .range(movsFrom, movsTo);

  const cutRows =
    cashCuts?.map((cut) => {
      const profile = cut.profiles as { full_name?: string } | undefined;
      return [
        new Date(cut.created_at).toLocaleString("es-MX"),
        profile?.full_name ?? "Sin usuario",
        `$${Number(cut.total_cash).toFixed(2)}`,
        `$${Number(cut.total_transfer).toFixed(2)}`,
        `$${Number(cut.total_card).toFixed(2)}`,
        `$${Number(cut.total_income).toFixed(2)}`,
        `$${Number(cut.expected_income ?? 0).toFixed(2)}`,
        `$${Number(cut.actual_cash_counted ?? 0).toFixed(2)}`,
        `$${Number(cut.difference ?? 0).toFixed(2)}`,
        cut.leakage_flag ? "Leakage" : "OK",
      ];
    }) ?? [];

  const movementRows =
    movements?.map((movement) => {
      const profile = movement.profiles as { full_name?: string } | undefined;
      const categoryLabel =
        movement.direction === "expense" && movement.expense_concept
          ? movement.expense_concept === "extras" && movement.concept_detail
            ? `Extras: ${movement.concept_detail}`
            : getExpenseConceptLabel(movement.expense_concept)
          : movement.category;
      return [
        movement.movement_date,
        movement.direction === "income" ? "Ingreso" : "Egreso",
        categoryLabel,
        `$${Number(movement.amount).toFixed(2)}`,
        profile?.full_name ?? "Sin usuario",
        movement.notes ?? "-",
      ];
    }) ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold text-text-main">Corte único diario</h2>
        <p className="mt-1 text-sm text-text-muted">
          Registra ingresos/egresos manuales y genera corte con responsable y trazabilidad.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <form action={createDailyCashCutAction}>
            <Button type="submit">Generar corte del día</Button>
          </form>
          <CashMovementForm action={createCashMovementAction} />
        </div>
      </Card>
      <Card>
        <h3 className="text-base font-semibold text-text-main">Registrar gasto operativo</h3>
        <p className="mt-1 text-sm text-text-muted">Conceptos de operación diaria. Un concepto por registro.</p>
        <div className="mt-4">
          <ExpenseCaptureForm action={createExpenseAction} returnTo="/dashboard/cash-cuts" />
        </div>
      </Card>
      <Card>
        <h3 className="text-base font-semibold text-text-main">Últimos cortes</h3>
        <div className="mt-3">
          <ResponsiveTable
            headers={["Fecha", "Responsable", "Efectivo", "Transfer", "Tarjeta", "Registrado", "Esperado", "Contado", "Dif", "Leakage"]}
            rows={cutRows}
            serverPagination={{
              page: cutsPag.page,
              pageSize: cutsPag.pageSize,
              totalCount: cutsCount ?? 0,
              paramPrefix: "cuts",
            }}
          />
        </div>
      </Card>
      <Card>
        <h3 className="text-base font-semibold text-text-main">Movimientos de caja</h3>
        <div className="mt-3">
          <ResponsiveTable
            headers={["Fecha", "Tipo", "Concepto", "Monto", "Responsable", "Notas"]}
            rows={movementRows}
            serverPagination={{
              page: movsPag.page,
              pageSize: movsPag.pageSize,
              totalCount: movsCount ?? 0,
              paramPrefix: "movs",
            }}
          />
        </div>
      </Card>
    </div>
  );
}
