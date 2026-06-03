"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getMexicoCityDateString, parseFinanceDayKey } from "@/lib/dates";

type FinanceDaySelectProps = {
  value: string;
  options: { value: string; label: string }[];
  monthKey: string;
  className?: string;
};

export function FinanceDaySelect({ value, options, monthKey, className }: FinanceDaySelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaultDay = parseFinanceDayKey(undefined, monthKey, getMexicoCityDateString());

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === defaultDay) {
      params.delete("financeDay");
    } else {
      params.set("financeDay", next);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Día del estado financiero"
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
