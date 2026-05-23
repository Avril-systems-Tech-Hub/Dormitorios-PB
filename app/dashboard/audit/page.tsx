import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";

export default async function AuditPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id,action,entity_type,created_at,actor_user_id,profiles:actor_user_id(full_name),metadata")
    .order("created_at", { ascending: false })
    .limit(80);

  // Obtener emails de los actores únicos
  const actorIds = [...new Set((logs ?? []).map((l) => l.actor_user_id).filter(Boolean))] as string[];
  const emailMap = new Map<string, string>();

  for (const uid of actorIds) {
    try {
      const { data } = await adminSupabase.auth.admin.getUserById(uid);
      if (data?.user?.email) emailMap.set(uid, data.user.email);
    } catch {
      // Si falla para un usuario, continuar
    }
  }

  const rows =
    logs?.map((log) => {
      const profile = log.profiles as { full_name?: string } | undefined;
      const email = log.actor_user_id ? (emailMap.get(log.actor_user_id) ?? "—") : "—";
      return [
        new Date(log.created_at).toLocaleString("es-MX"),
        profile?.full_name ?? "Sistema",
        email,
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
        headers={["Fecha", "Actor", "Correo", "Acción", "Entidad", "Metadata"]}
        rows={rows}
      />
    </div>
  );
}
