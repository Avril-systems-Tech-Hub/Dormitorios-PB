import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";

export default async function AuditPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id,action,entity_type,created_at,profiles:actor_user_id(full_name),metadata")
    .order("created_at", { ascending: false })
    .limit(80);

  const rows =
    logs?.map((log) => {
      const profile = log.profiles as { full_name?: string } | undefined;
      return [
        new Date(log.created_at).toLocaleString("es-MX"),
        profile?.full_name ?? "Sistema",
        log.action,
        log.entity_type,
        JSON.stringify(log.metadata),
      ];
    }) ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold text-text-main">Log de auditoría inalterable</h2>
        <p className="mt-1 text-sm text-text-muted">
          Historial de cobros, cortes, tickets y cambios críticos con usuario y marca de tiempo.
        </p>
      </Card>
      <ResponsiveTable
        headers={["Fecha", "Actor", "Acción", "Entidad", "Metadata"]}
        rows={rows}
      />
    </div>
  );
}
