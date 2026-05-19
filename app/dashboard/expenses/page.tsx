import { createExpenseAction } from "@/actions/operations";
import { ExpenseCaptureForm } from "@/components/forms/expense-capture-form";
import { Card } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth/guards";
import { getExpenseConceptLabel } from "@/lib/expense-concepts";
import { getDayFinanceSummary } from "@/lib/day-finance";
import { getMexicoCityDateString } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReactNode } from "react";

const EXPENSE_RECEIPTS_BUCKET = "expense-receipts";

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
};

export default async function ExpensesPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const today = getMexicoCityDateString();
  const summary = await getDayFinanceSummary(supabase, today);

  const { data: expenses } = await supabase
    .from("cash_movements")
    .select(
      "id,movement_date,expense_concept,concept_detail,amount,method,notes,receipt_image_path,recorded_at,profiles:responsible_profile_id(full_name)",
    )
    .eq("direction", "expense")
    .order("recorded_at", { ascending: false })
    .limit(50);

  const rows = await Promise.all(
    (expenses ?? []).map(async (expense) => {
      const profile = expense.profiles as { full_name?: string } | undefined;
      let photoCell: ReactNode = "—";

      if (expense.receipt_image_path) {
        const { data } = await adminSupabase.storage
          .from(EXPENSE_RECEIPTS_BUCKET)
          .createSignedUrl(expense.receipt_image_path, 3600);
        if (data?.signedUrl) {
          photoCell = (
            <a
              key={`photo-${expense.id}`}
              href={data.signedUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-brand-primary underline"
            >
              Ver foto
            </a>
          );
        }
      }

      const conceptLabel = getExpenseConceptLabel(expense.expense_concept);
      const detail =
        expense.expense_concept === "extras" && expense.concept_detail
          ? `${conceptLabel}: ${expense.concept_detail}`
          : conceptLabel;

      return [
        expense.movement_date,
        detail,
        `$${Number(expense.amount).toFixed(2)}`,
        METHOD_LABELS[expense.method] ?? expense.method,
        profile?.full_name ?? "Sin usuario",
        expense.notes ?? "—",
        photoCell,
        new Date(expense.recorded_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
      ];
    }),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-text-muted">Ingresos del día (huéspedes)</p>
          <p className="mt-1 text-2xl font-semibold">${summary.totalGuestIncome.toFixed(2)}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-muted">Gastos del día</p>
          <p className="mt-1 text-2xl font-semibold">${summary.totalExpenses.toFixed(2)}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-muted">Resultado neto del día</p>
          <p className="mt-1 text-2xl font-semibold">${summary.netResult.toFixed(2)}</p>
          <Badge variant={summary.netResult >= 0 ? "success" : "warning"} className="mt-2">
            {summary.netResult >= 0 ? "Positivo" : "Negativo"}
          </Badge>
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-text-main">Registrar gasto</h2>
        <p className="mt-1 text-sm text-text-muted">Un concepto por registro. La foto del ticket es opcional.</p>
        <div className="mt-4">
          <ExpenseCaptureForm action={createExpenseAction} returnTo="/dashboard/expenses" />
        </div>
      </Card>

      <Card>
        <h3 className="text-base font-semibold text-text-main">Últimos gastos</h3>
        <div className="mt-3">
          <ResponsiveTable
            headers={["Fecha", "Concepto", "Monto", "Método", "Responsable", "Notas", "Foto", "Registrado"]}
            rows={rows}
          />
        </div>
      </Card>
    </div>
  );
}
