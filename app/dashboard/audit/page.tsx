import { Suspense } from "react";
import { AuditOverview } from "@/components/dashboard/audit-overview";
import { AuditTechnicalDetail } from "@/components/dashboard/audit-technical-detail";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { requireRole } from "@/lib/auth/guards";
import {
  formatAuditDetailLines,
  formatAuditSummary,
  getAuditActionLabel,
  getAuditCategoryActions,
  getAuditCategoryForAction,
  getAuditCategoryLabel,
  getAuditEntityLabel,
  parseAuditCategory,
  parseAuditMetadata,
} from "@/lib/audit-log-presenter";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePagination, getRange, escapeIlike } from "@/lib/pagination";
import { formatMexicoCityDateTime } from "@/lib/dates";

const CATEGORY_BADGE_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "danger"
> = {
  reservations: "success",
  payments: "success",
  cash: "warning",
  beds: "default",
  import: "default",
  messages: "default",
  all: "default",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const { page, pageSize, q } = parsePagination(params);
  const [from, to] = getRange(page, pageSize);
  const category = parseAuditCategory(params.auditCategory);
  const categoryActions = getAuditCategoryActions(category);

  const adminSupabase = createAdminClient();

  let query = adminSupabase
    .from("audit_logs")
    .select(
      "id,action,entity_type,created_at,actor_user_id,profiles:actor_user_id(full_name),metadata",
      { count: "exact" },
    );

  if (categoryActions?.length) {
    query = query.in("action", categoryActions);
  }

  if (q) {
    const safe = escapeIlike(q);
    query = query.or(
      `action.ilike.%${safe}%,entity_type.ilike.%${safe}%,metadata->>folio_code.ilike.%${safe}%`,
    );
  }

  const { data: logs, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  const actorIds = [...new Set((logs ?? []).map((l) => l.actor_user_id).filter(Boolean))] as string[];
  const emailMap = new Map<string, string>();

  await Promise.all(
    actorIds.map(async (uid) => {
      try {
        const { data } = await adminSupabase.auth.admin.getUserById(uid);
        if (data?.user?.email) emailMap.set(uid, data.user.email);
      } catch {
        // omitir si no hay acceso al usuario
      }
    }),
  );

  const rows =
    logs?.map((log) => {
      const profile = log.profiles as { full_name?: string } | undefined;
      const email = log.actor_user_id ? (emailMap.get(log.actor_user_id) ?? "") : "";
      const actorName = profile?.full_name ?? "Sistema";
      const metadata = parseAuditMetadata(log.metadata);
      const actionLabel = getAuditActionLabel(log.action);
      const summary = formatAuditSummary(log.action, metadata);
      const detailLines = formatAuditDetailLines(log.action, metadata);
      const auditCategory = getAuditCategoryForAction(log.action);
      const categoryLabel = getAuditCategoryLabel(auditCategory);
      const entityLabel = getAuditEntityLabel(log.entity_type);
      const metadataJson = JSON.stringify(metadata ?? {}, null, 0);

      const actorCell = (
        <div key={`actor-${log.id}`} className="min-w-0">
          <p className="font-medium text-text-main">{actorName}</p>
          {email ? <p className="text-xs text-text-muted">{email}</p> : null}
        </div>
      );

      const activityCell = (
        <div key={`activity-${log.id}`} className="min-w-0 space-y-1">
          <p className="font-medium text-text-main">{actionLabel}</p>
          <div className="flex flex-wrap gap-1">
            <Badge variant={CATEGORY_BADGE_VARIANT[auditCategory] ?? "default"}>
              {categoryLabel}
            </Badge>
            <Badge variant="default">{entityLabel}</Badge>
          </div>
        </div>
      );

      const detailCell = (
        <div key={`detail-${log.id}`} className="min-w-0 space-y-1 text-sm">
          <p className="text-text-main">{summary}</p>
          {detailLines.length > 0 ? (
            <ul className="list-inside list-disc text-xs text-text-muted">
              {detailLines.slice(0, 4).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <AuditTechnicalDetail
            action={log.action}
            entityType={log.entity_type}
            metadataJson={metadataJson}
          />
        </div>
      );

      return [
        formatMexicoCityDateTime(log.created_at),
        actorCell,
        activityCell,
        detailCell,
      ];
    }) ?? [];

  return (
    <div className="space-y-4">
      <Suspense
        fallback={
          <div className="h-24 animate-pulse rounded-xl border border-border-soft bg-surface-soft" />
        }
      >
        <AuditOverview category={category} totalInView={rows.length} />
      </Suspense>

      <ResponsiveTable
        headers={["Cuándo", "Quién", "Qué pasó", "Detalle"]}
        rows={rows}
        filterMode="global"
        serverPagination={{
          page,
          pageSize,
          totalCount: count ?? 0,
          searchQuery: q,
          searchPlaceholder: "Buscar por folio, actividad o tipo…",
        }}
      />
    </div>
  );
}
