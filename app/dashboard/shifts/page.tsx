import { createAdminClient } from "@/lib/supabase/admin";
import { requireModulePermission } from "@/lib/auth/guards";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { parsePagination, getRange } from "@/lib/pagination";

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModulePermission("shifts");
  const params = await searchParams;
  const { page, pageSize } = parsePagination(params);
  const [from, to] = getRange(page, pageSize);

  const supabase = createAdminClient();
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
        <h2 className="text-lg font-semibold text-text-main">Turnos operativos</h2>
        <p className="mt-1 text-sm text-text-muted">
          Un corte diario cierra el turno abierto y deja trazabilidad del responsable.
        </p>
      </Card>
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
