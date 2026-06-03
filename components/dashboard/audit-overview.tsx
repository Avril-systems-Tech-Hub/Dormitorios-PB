"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AUDIT_CATEGORY_FILTERS,
  parseAuditCategory,
  type AuditCategory,
} from "@/lib/audit-log-presenter";

type AuditOverviewProps = {
  category: AuditCategory;
  totalInView: number;
};

export function AuditOverview({ category, totalInView }: AuditOverviewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCategory = parseAuditCategory(searchParams.get("auditCategory") ?? category);

  const setCategory = (next: AuditCategory) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      params.delete("auditCategory");
    } else {
      params.set("auditCategory", next);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/dashboard/audit?${qs}` : "/dashboard/audit");
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-main">Actividad del sistema</h2>
          <p className="mt-1 text-sm text-text-muted">
            Registro de lo que hace el equipo en recepción: reservas, cobros, gastos, camas e
            importaciones. Cada evento queda con usuario y hora.
          </p>
        </div>
        <div
          className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-border-soft bg-surface-soft p-0.5 text-xs"
          role="group"
          aria-label="Filtrar actividad"
        >
          {AUDIT_CATEGORY_FILTERS.map(({ value, toggleLabel }) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={cn(
                "rounded-md px-2 py-1 font-medium transition",
                activeCategory === value
                  ? "bg-white text-text-main shadow-sm"
                  : "text-text-muted hover:text-text-main",
              )}
            >
              {toggleLabel}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-text-muted">
        {totalInView === 0
          ? "No hay eventos en esta página con el filtro actual."
          : `Mostrando ${totalInView} evento${totalInView === 1 ? "" : "s"} en esta página.`}
      </p>
    </Card>
  );
}
