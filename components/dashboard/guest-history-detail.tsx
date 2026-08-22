"use client";

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatBedLabel } from "@/lib/beds";

export type GuestStaySummary = {
  checkIn: string;
  checkOut: string;
  nights: number;
  bedNumber?: string | number;
  bedZone?: string | null;
  lockerNumber?: string | number | null;
  lockerDays?: number;
  folioCode?: string;
  paymentStatus?: string;
  totalAmount?: number;
  paidAmount?: number;
  balanceDue?: number;
  source?: string;
  reservationNotes?: string | null;
  createdAt?: string;
  reservationId?: string;
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
  const sorted = [...stays].sort((a, b) => {
    const created = (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    if (created !== 0) return created;
    return b.checkIn.localeCompare(a.checkIn);
  });
  const history = sorted.filter(
    (stay) =>
      stay.checkIn !== latest.checkIn ||
      stay.checkOut !== latest.checkOut ||
      stay.bedNumber !== latest.bedNumber,
  );

  return (
    <div className="min-w-[11rem] max-w-[28rem]">
      <p className="whitespace-nowrap text-sm text-text-main">{formatStayRange(latest.checkIn, latest.checkOut)}</p>
      <p className="mt-0.5 whitespace-nowrap text-xs text-text-muted">
        {latest.nights} noche{latest.nights === 1 ? "" : "s"}
        {latest.bedNumber != null ? ` · ${formatBedLabel(latest.bedNumber, latest.bedZone) ?? latest.bedNumber}` : ""}
        {latest.lockerNumber ? ` · Locker ${latest.lockerNumber}` : ""}
      </p>
      {latest.reservationNotes ? (
        <p className="mt-1 whitespace-pre-wrap text-xs text-text-main">
          <span className="font-semibold">Nota de reservación:</span> {latest.reservationNotes}
        </p>
      ) : (
        <p className="mt-1 text-xs italic text-text-muted">Sin nota general de reservación.</p>
      )}

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
            <div className="mt-2 max-h-36 overflow-x-auto overflow-y-auto rounded-lg border border-border-soft bg-surface-soft/80 p-2 text-xs">
              <div className="grid min-w-max grid-cols-[auto_auto_auto_auto] items-center gap-x-3 gap-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Fechas</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Detalle</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Folio</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Pago</div>
                {history.map((stay) => (
                  <Fragment key={`${stay.checkIn}-${stay.checkOut}-${stay.bedNumber ?? "x"}`}>
                    <span className="whitespace-nowrap font-medium text-text-main">{formatStayRange(stay.checkIn, stay.checkOut)}</span>
                    <span className="whitespace-nowrap text-text-muted">
                      {stay.nights}n{stay.bedNumber != null ? ` · ${formatBedLabel(stay.bedNumber, stay.bedZone) ?? stay.bedNumber}` : ""}
                    </span>
                    <span
                      className="whitespace-nowrap font-mono text-text-main"
                      title={stay.folioCode ?? undefined}
                    >
                      {stay.folioCode ?? "—"}
                    </span>
                    <span className="whitespace-nowrap text-text-muted">
                      <PaymentStatusBadge status={stay.paymentStatus} />
                      {stay.paidAmount != null ? (
                        <span className="ml-1">${stay.paidAmount.toFixed(2)}</span>
                      ) : null}
                    </span>
                    <div className="col-span-4 border-b border-border-soft pb-2">
                      <p className="mb-1 whitespace-pre-wrap text-text-muted">
                        <span className="font-medium text-text-main">Nota de reservación:</span>{" "}
                        {stay.reservationNotes || "Sin nota general."}
                      </p>
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function PaymentStatusBadge({ status }: { status?: string }) {
  if (status === "liquidated") return <Badge variant="success">Pagado</Badge>;
  if (status === "partial") return <Badge variant="warning">Parcial</Badge>;
  if (status === "pending") return <Badge variant="warning">Pendiente</Badge>;
  return <span className="text-text-muted">—</span>;
}

export function GuestStatsCell({
  stayCount,
  totalNights,
  totalLockerDays = 0,
  source,
}: {
  stayCount: number;
  totalNights: number;
  totalLockerDays?: number;
  paymentStatus?: string;
  source: string;
}) {
  const isCashier = source === "cashier_counter";

  return (
    <div className="space-y-1.5 whitespace-nowrap">
      <p className="text-sm text-text-main">
        <span className="font-medium">{stayCount}</span> estadía{stayCount === 1 ? "" : "s"}
        <span className="text-text-muted"> · </span>
        <span className="font-medium">{totalNights}</span> noches
      </p>
      {totalLockerDays > 0 ? (
        <p className="text-xs text-text-muted">
          Locker: <span className="font-medium text-text-main">{totalLockerDays}</span> día
          {totalLockerDays === 1 ? "" : "s"}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        <Badge variant={isCashier ? "warning" : "success"}>{isCashier ? "Caja" : "App"}</Badge>
      </div>
    </div>
  );
}

export function GuestFolioCell({ folioCode }: { folioCode?: string }) {
  if (!folioCode) {
    return <span className="text-sm text-text-muted">—</span>;
  }

  return (
    <span className="whitespace-nowrap font-mono text-sm text-text-main" title={folioCode}>
      {folioCode}
    </span>
  );
}

export function GuestPaymentCell({
  paymentStatus,
  totalAmount = 0,
  paidAmount = 0,
  balanceDue = 0,
}: {
  paymentStatus?: string;
  totalAmount?: number;
  paidAmount?: number;
  balanceDue?: number;
}) {
  if (!paymentStatus && totalAmount === 0 && paidAmount === 0) {
    return <span className="text-sm text-text-muted">—</span>;
  }

  return (
    <div className="min-w-[9rem] space-y-1 whitespace-nowrap">
      <PaymentStatusBadge status={paymentStatus} />
      <p className="text-sm text-text-main">
        <span className="font-medium">${paidAmount.toFixed(2)}</span>
        <span className="text-text-muted"> pagado</span>
      </p>
      <p className="text-xs text-text-muted">
        Total ${totalAmount.toFixed(2)}
        {balanceDue > 0 ? ` · Saldo $${balanceDue.toFixed(2)}` : null}
      </p>
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
