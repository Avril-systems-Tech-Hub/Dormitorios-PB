import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";

export default async function ShiftsPage() {
  const supabase = await createClient();
  const { data: shifts } = await supabase
    .from("shifts")
    .select("id,status,opened_at,closed_at,open_by:opened_by(full_name),close_by:closed_by(full_name)")
    .order("opened_at", { ascending: false })
    .limit(30);

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
      />
    </div>
  );
}
