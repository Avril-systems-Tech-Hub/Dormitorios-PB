import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile, requireModulePermission } from "@/lib/auth/guards";
import { ExpenseRegisterPanel } from "@/components/dashboard/expense-register-panel";
import { ShiftActionButtons } from "@/components/dashboard/shift-action-buttons";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { formatOpenShiftLabel, getOpenShift, getShiftExpenseTotal } from "@/lib/open-shift";
import { parsePagination, getRange } from "@/lib/pagination";

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModulePermission("shifts");
  const profile = await getSessionProfile();
  const params = await searchParams;
  const { page, pageSize } = parsePagination(params);
  const [from, to] = getRange(page, pageSize);

  const supabase = createAdminClient();
  const openShift = await getOpenShift();
  const shiftLabel = openShift ? formatOpenShiftLabel(openShift) : undefined;
  const shiftExpenseTotal =
    openShift && profile.role === "reception" ? await getShiftExpenseTotal(openShift.id) : undefined;

  const { data: shifts, count } = await supabase
    .from("shifts")
    .select(
      "id,status,opened_at,closed_at,open_by:opened_by(full_name),close_by:closed_by(full_name)",
      { count: "exact" },
    )
    .order("opened_at", { ascending: false })
    .range(from, to);

  const rows =
    shifts?.map((shift) => {
      const openedBy = shift.open_by as { full_name?: string } | undefined;
      const closedBy = shift.close_by as { full_name?: string } | undefined;
      return [
        new Date(shift.opened_at).toLocaleString("es-MX"),
        shift.closed_at ? new Date(shift.closed_at).toLocaleString("es-MX") : "-",
        openedBy?.full_name ?? "Sin usuario",
        closedBy?.full_name ?? "-",
        <Badge key={shift.id} variant={shift.status === "open" ? "warning" : "success"}>
          {shift.status}
        </Badge>,
      ];
    }) ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-text-main">Turnos operativos</h2>
              <Badge variant={openShift ? "warning" : "success"}>
                {openShift ? "Turno abierto" : "Sin turno activo"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              {openShift
                ? `${shiftLabel}. Inicia o cierra turno aquí; los egresos de recepción se registran en este turno.`
                : "Inicia turno aquí antes de registrar egresos en recepción."}
            </p>
          </div>
          <ShiftActionButtons hasOpenShift={Boolean(openShift)} returnTo="/dashboard/shifts" />
        </div>
      </Card>

      {profile.role === "reception" ? (
        <ExpenseRegisterPanel
          returnTo="/dashboard/shifts"
          hasOpenShift={Boolean(openShift)}
          shiftLabel={shiftLabel}
          shiftExpenseTotal={shiftExpenseTotal}
          defaultOpen={Boolean(openShift)}
        />
      ) : null}

      <ResponsiveTable
        headers={["Apertura", "Cierre", "Abrió", "Cerró", "Estatus"]}
        rows={rows}
        serverPagination={{
          page,
          pageSize,
          totalCount: count ?? 0,
        }}
      />
    </div>
  );
}
