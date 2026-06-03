"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  FOLIO_SUMMARY_FILTERS,
  getFolioSummaryMeta,
  parseFolioSummaryFilter,
  type FolioSummaryCounts,
  type FolioSummaryFilter,
} from "@/lib/folio-summary";

type FolioSummaryCardProps = {
  counts: FolioSummaryCounts;
  initialFilter: FolioSummaryFilter;
};

export function FolioSummaryCard({ counts, initialFilter }: FolioSummaryCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = parseFolioSummaryFilter(searchParams.get("folioFilter") ?? initialFilter);
  const meta = getFolioSummaryMeta(filter);
  const count = counts[filter];

  const setFilter = (next: FolioSummaryFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "por_pagar") {
      params.delete("folioFilter");
    } else {
      params.set("folioFilter", next);
    }
    const qs = params.toString();
    router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
  };

  return (
    <Card className="h-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-text-muted">{meta.title}</p>
        <div
          className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-border-soft bg-surface-soft p-0.5 text-[11px]"
          role="group"
          aria-label="Tipo de folio"
        >
          {FOLIO_SUMMARY_FILTERS.map(({ value, toggleLabel }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-md px-1.5 py-1 font-medium transition",
                filter === value
                  ? "bg-white text-text-main shadow-sm"
                  : "text-text-muted hover:text-text-main",
              )}
            >
              {toggleLabel}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-1 text-2xl font-semibold">{count}</p>
      {meta.hint ? <p className="mt-0.5 text-xs text-text-muted">{meta.hint}</p> : null}
      <Badge variant={meta.badgeVariant} className="mt-2">
        {meta.badge}
      </Badge>
      <Link
        href="/dashboard/reservations"
        className="mt-2 inline-block text-xs font-medium text-brand-primary hover:underline"
      >
        Ver reservas
      </Link>
    </Card>
  );
}
