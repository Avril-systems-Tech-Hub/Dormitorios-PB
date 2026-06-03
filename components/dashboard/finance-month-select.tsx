"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getMexicoCityMonthKey } from "@/lib/dates";

type FinanceMonthSelectProps = {
  value: string;
  options: { value: string; label: string }[];
  className?: string;
  ariaLabel?: string;
  clearParams?: string[];
};

export function FinanceMonthSelect({
  value,
  options,
  className,
  ariaLabel = "Mes",
  clearParams,
}: FinanceMonthSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentMonth = getMexicoCityMonthKey();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === currentMonth) {
      params.delete("financeMonth");
    } else {
      params.set("financeMonth", next);
    }
    params.delete("page");
    params.delete("financeDay");
    params.delete("financeWeek");
    for (const key of clearParams ?? []) {
      params.delete(key);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      className={
        className ??
        "mt-0.5 w-full max-w-[11rem] rounded-md border border-border-soft bg-white px-2 py-1 text-xs capitalize text-text-main"
      }
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="capitalize">
          {option.label}
        </option>
      ))}
    </select>
  );
}
