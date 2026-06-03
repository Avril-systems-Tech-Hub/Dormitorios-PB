"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

type ReservationDetail = {
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  folio_code?: string;
  check_in?: string;
  check_out?: string;
  nights?: number;
  source?: string;
  created_at?: string;
  payment_status?: string;
  total_amount?: number;
  balance_due?: number;
  notes?: string;
  locker_number?: number | null;
  locker_days?: number;
};

export function BedCardAccordion({ detail }: { detail: ReservationDetail | null }) {
  const [open, setOpen] = useState(false);

  if (!detail) return null;

  const sourceLabel = detail.source === "cashier_counter" ? "Caja" : "App cliente";
  const payLabel = detail.payment_status ?? "pending";
  const lockerNum =
    detail.locker_number != null && detail.locker_number > 0 ? detail.locker_number : null;
  const lockerDays = Number(detail.locker_days ?? 0);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-mkt-slate transition hover:text-mkt-slate-deep"
      >
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Ver detalle
      </button>

      {open && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-border-soft bg-gray-50 p-2 text-xs">
          <div className="flex justify-between">
            <span className="text-text-muted">Huésped</span>
            <span className="text-text-main font-medium">{detail.guest_name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Teléfono</span>
            <span className="text-text-main">{detail.guest_phone ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-text-muted shrink-0">Correo</span>
            <span className="text-text-main min-w-0 break-all text-right">{detail.guest_email ?? "—"}</span>
          </div>
          <hr className="border-border-soft" />
          <div className="flex justify-between gap-2">
            <span className="text-text-muted shrink-0">Folio</span>
            <span className="text-text-main min-w-0 break-all text-right font-medium">{detail.folio_code ?? "Sin folio"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Check-in</span>
            <span className="text-text-main">{detail.check_in ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Check-out</span>
            <span className="text-text-main">{detail.check_out ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Noches</span>
            <span className="text-text-main">
              {detail.nights ?? "—"}
              {lockerDays > 0 ? (
                <span className="block text-[10px] text-text-muted">
                  Locker: {lockerDays} día{lockerDays === 1 ? "" : "s"}
                </span>
              ) : null}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted">Locker</span>
            {lockerNum != null ? (
              <span className="font-medium text-text-main">#{lockerNum}</span>
            ) : lockerDays > 0 ? (
              <Badge variant="warning">Pendiente</Badge>
            ) : (
              <span className="text-text-main">—</span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Origen</span>
            <span className="text-text-main">{sourceLabel}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-text-muted shrink-0">Creada</span>
            <span className="text-text-main min-w-0 break-all text-right">
              {detail.created_at
                ? new Date(detail.created_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted">Pago</span>
            <Badge variant={payLabel === "liquidated" ? "success" : "warning"}>
              {payLabel}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Total</span>
            <span className="text-text-main">${Number(detail.total_amount ?? 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Saldo</span>
            <span className="text-text-main font-semibold">${Number(detail.balance_due ?? 0).toFixed(2)}</span>
          </div>
          {detail.notes && (
            <>
              <hr className="border-border-soft" />
              <div>
                <span className="text-text-muted">Notas</span>
                <p className="mt-0.5 text-text-main">{detail.notes}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}