"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { GuestPaymentFilter } from "@/lib/guest-payment-filter";
import { cn } from "@/lib/utils";

const OPTIONS: { value: GuestPaymentFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "paid", label: "Pagados" },
  { value: "debt", label: "Deudores" },
];

export function GuestsPaymentFilter({
  value,
  basePath = "/dashboard/guests",
  paramPrefix,
  className,
}: {
  value: GuestPaymentFilter;
  basePath?: string;
  paramPrefix?: string;
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterKey = paramPrefix ? `${paramPrefix}_paymentFilter` : "paymentFilter";
  const pageKey = paramPrefix ? `${paramPrefix}_page` : "page";

  function setFilter(next: GuestPaymentFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete(filterKey);
    else params.set(filterKey, next);
    params.delete(pageKey);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-border-soft bg-surface-soft p-0.5 text-xs",
        className,
      )}
      role="group"
      aria-label="Filtrar por estado de pago"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setFilter(option.value)}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition",
            value === option.value
              ? "bg-white text-text-main shadow-sm"
              : "text-text-muted hover:text-text-main",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
