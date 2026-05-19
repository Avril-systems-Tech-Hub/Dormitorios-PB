"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export type GuestStaySummary = {
  checkIn: string;
  checkOut: string;
  nights: number;
  bedNumber?: number;
  lockerNumber?: number | null;
  folioCode?: string;
  paymentStatus?: string;
  source?: string;
};

function formatShortDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City",
  });
}

function formatStayRange(checkIn: string, checkOut: string) {
  return `${formatShortDate(checkIn)} – ${formatShortDate(checkOut)}`;
}

export function GuestHistoryDetail({
  stays,
  latest,
}: {
  stays: GuestStaySummary[];
  latest: GuestStaySummary;
}) {
  const [open, setOpen] = useState(false);
  const sorted = [...stays].sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  const history = sorted.filter(
    (stay) =>
      stay.checkIn !== latest.checkIn ||
      stay.checkOut !== latest.checkOut ||
      stay.bedNumber !== latest.bedNumber,
  );

  return (
    <div className="min-w-[11rem] max-w-[16rem]">
      <p className="whitespace-nowrap text-sm text-text-main">{formatStayRange(latest.checkIn, latest.checkOut)}</p>
      <p className="mt-0.5 whitespace-nowrap text-xs text-text-muted">
        {latest.nights} noche{latest.nights === 1 ? "" : "s"}
        {latest.bedNumber != null ? ` · Cama ${latest.bedNumber}` : ""}
        {latest.lockerNumber ? ` · Locker ${latest.lockerNumber}` : ""}
      </p>
      {latest.folioCode ? (
        <p className="mt-0.5 truncate text-xs text-text-muted" title={latest.folioCode}>
          {latest.folioCode}
        </p>
      ) : null}

      {history.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline"
          >
            <Chevron open={open} />
            {open ? "Ocultar historial" : `Ver ${history.length} estadía${history.length === 1 ? "" : "s"} anterior${history.length === 1 ? "" : "es"}`}
          </button>
          {open ? (
            <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-border-soft bg-surface-soft/80 p-2 text-xs">
              {history.map((stay) => (
                <li key={`${stay.checkIn}-${stay.checkOut}-${stay.bedNumber ?? "x"}`} className="text-text-main">
                  <span className="font-medium">{formatStayRange(stay.checkIn, stay.checkOut)}</span>
                  <span className="text-text-muted">
                    {" "}
                    · {stay.nights}n{stay.bedNumber != null ? ` · Cama ${stay.bedNumber}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function GuestStatsCell({
  stayCount,
  totalNights,
  paymentStatus,
  source,
}: {
  stayCount: number;
  totalNights: number;
  paymentStatus?: string;
  source: string;
}) {
  const isPaid = paymentStatus === "liquidated";
  const isCashier = source === "cashier_counter";

  return (
    <div className="space-y-1.5 whitespace-nowrap">
      <p className="text-sm text-text-main">
        <span className="font-medium">{stayCount}</span> estadía{stayCount === 1 ? "" : "s"}
        <span className="text-text-muted"> · </span>
        <span className="font-medium">{totalNights}</span> noches
      </p>
      <div className="flex flex-wrap gap-1">
        <Badge variant={isPaid ? "success" : "warning"}>{isPaid ? "Pagado" : "Pendiente"}</Badge>
        <Badge variant={isCashier ? "warning" : "success"}>{isCashier ? "Caja" : "App"}</Badge>
      </div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
