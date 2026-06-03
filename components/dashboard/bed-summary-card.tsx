"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BED_SUMMARY_FILTERS,
  getBedSummaryMeta,
  parseBedSummaryFilter,
  type BedSummaryCounts,
  type BedSummaryFilter,
} from "@/lib/bed-summary";

type BedSummaryCardProps = {
  counts: BedSummaryCounts;
  initialFilter: BedSummaryFilter;
  occupiedToday: number;
};

export function BedSummaryCard({ counts, initialFilter, occupiedToday }: BedSummaryCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = parseBedSummaryFilter(searchParams.get("bedFilter") ?? initialFilter);
  const meta = getBedSummaryMeta(filter);
  const count = counts[filter];

  const setFilter = (next: BedSummaryFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "inventario") {
      params.delete("bedFilter");
    } else {
      params.set("bedFilter", next);
    }
    const qs = params.toString();
    router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
  };

  return (
    <Card className="h-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-text-muted">{meta.title}</p>
        <div
          className="inline-flex shrink-0 rounded-lg border border-border-soft bg-surface-soft p-0.5 text-[11px]"
          role="group"
          aria-label="Vista de camas"
        >
          {BED_SUMMARY_FILTERS.map(({ value, toggleLabel }) => (
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
      {filter === "libres" && occupiedToday > 0 ? (
        <p className="mt-0.5 text-xs text-text-muted">
          <span className="font-medium text-text-main">{occupiedToday}</span> ocupada
          {occupiedToday === 1 ? "" : "s"} hoy
        </p>
      ) : null}
      {meta.badge ? (
        <Badge variant={meta.badgeVariant ?? "success"} className="mt-2">
          {meta.badge}
        </Badge>
      ) : null}
      <Link
        href="/dashboard/beds"
        className="mt-2 inline-block text-xs font-medium text-brand-primary hover:underline"
      >
        Ver mapa de camas
      </Link>
    </Card>
  );
}
