"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getMexicoCityDateString, parseFinanceWeekAnchor } from "@/lib/dates";

type FinanceWeekSelectProps = {
  value: string;
  options: { value: string; label: string }[];
  monthKey: string;
  className?: string;
};

export function FinanceWeekSelect({ value, options, monthKey, className }: FinanceWeekSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaultWeek = parseFinanceWeekAnchor(undefined, monthKey, getMexicoCityDateString());

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === defaultWeek) {
      params.delete("financeWeek");
    } else {
      params.set("financeWeek", next);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Semana del estado financiero"
      className={
        className ??
        "rounded-md border border-border-soft bg-white px-2 py-1 text-xs capitalize text-text-main"
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
