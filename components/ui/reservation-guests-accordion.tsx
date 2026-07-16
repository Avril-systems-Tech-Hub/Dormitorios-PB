"use client";

import { useState } from "react";
import {
  GuestAssignmentActions,
  parseGuestAssignmentRow,
  type GuestAssignmentGuestRow,
} from "@/components/ui/guest-assignment-actions";

export function ReservationGuestsAccordion({
  guests,
  reservationId,
  nights = 1,
  returnTo = "/dashboard/reservations",
  readOnly = false,
}: {
  guests: GuestAssignmentGuestRow[];
  reservationId: string;
  nights?: number;
  returnTo?: string;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!guests.length) return null;

  return (
    <div className="mt-1">
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
        {guests.length} huésped{guests.length > 1 ? "es" : ""}
      </button>

      {open ? (
        <div className="mt-2 rounded-lg border border-border-soft bg-gray-50">
          <div className="max-h-[min(70vh,24rem)] divide-y divide-border-soft overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] md:hidden">
            {guests.map((g, i) => {
              const rawGuest = Array.isArray(g.guests) ? g.guests[0] : g.guests;
              const guest = rawGuest as { full_name?: string; phone?: string; email?: string } | undefined;
              const parsed = parseGuestAssignmentRow(g);

              return (
                <div key={parsed.guestId || i} className="space-y-2 p-3 text-xs">
                  <p className="font-semibold text-text-main">
                    Huésped {i + 1}
                    {guest?.full_name ? ` · ${guest.full_name}` : ""}
                  </p>
                  <div className="grid grid-cols-[minmax(4.5rem,38%)_1fr] gap-x-3 gap-y-1.5">
                    <span className="text-text-muted">Teléfono</span>
                    <span className="text-text-main">{guest?.phone ?? "—"}</span>
                    <span className="text-text-muted">Correo</span>
                    <span className="min-w-0 break-all text-text-main">{guest?.email ?? "—"}</span>
                    <span className="text-text-muted">Asignación</span>
                    <span className="text-text-main">
                      <GuestAssignmentActions
                        reservationId={reservationId}
                        guestId={parsed.guestId}
                        bedNumber={parsed.bedNumber}
                        lockerNumber={parsed.lockerNumber}
                        lockerDays={parsed.lockerDays}
                        nights={nights}
                        returnTo={returnTo}
                        readOnly={readOnly}
                      />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden max-h-[min(70vh,24rem)] overflow-auto overscroll-contain md:block">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-[1] bg-gray-100 text-text-muted">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">#</th>
                  <th className="px-3 py-1.5 text-left font-medium">Nombre</th>
                  <th className="px-3 py-1.5 text-left font-medium">Teléfono</th>
                  <th className="px-3 py-1.5 text-left font-medium">Correo</th>
                  <th className="px-3 py-1.5 text-left font-medium">Cama / Locker</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g, i) => {
                  const rawGuest = Array.isArray(g.guests) ? g.guests[0] : g.guests;
                  const guest = rawGuest as { full_name?: string; phone?: string; email?: string } | undefined;
                  const parsed = parseGuestAssignmentRow(g);

                  return (
                    <tr key={parsed.guestId || i} className="border-t border-border-soft">
                      <td className="px-3 py-1.5 text-text-main">{i + 1}</td>
                      <td className="px-3 py-1.5 text-text-main">{guest?.full_name ?? "—"}</td>
                      <td className="px-3 py-1.5 text-text-main">{guest?.phone ?? "—"}</td>
                      <td className="px-3 py-1.5 text-text-main">{guest?.email ?? "—"}</td>
                      <td className="px-3 py-1.5 text-text-main">
                        <GuestAssignmentActions
                          reservationId={reservationId}
                          guestId={parsed.guestId}
                          bedNumber={parsed.bedNumber}
                          lockerNumber={parsed.lockerNumber}
                          lockerDays={parsed.lockerDays}
                          nights={nights}
                          returnTo={returnTo}
                          readOnly={readOnly}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
