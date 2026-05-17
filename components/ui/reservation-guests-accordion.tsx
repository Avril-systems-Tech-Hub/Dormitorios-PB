"use client";

import { useState } from "react";
import { BedChangeButton } from "@/components/ui/bed-change-button";

type GuestInfo = {
  id?: string;
  full_name?: string;
  phone?: string;
  email?: string;
};

type BedInfo = {
  id?: string;
  bed_number?: number;
};

type GuestRow = {
  guest_id?: string;
  guests?: GuestInfo | GuestInfo[] | null;
  beds?: BedInfo | BedInfo[] | null;
};

export function ReservationGuestsAccordion({
  guests,
  reservationId,
}: {
  guests: GuestRow[];
  reservationId: string;
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

      {open && (
        <div className="mt-2 overflow-hidden rounded-lg border border-border-soft bg-gray-50">
          <table className="w-full text-xs">
            <thead className="bg-gray-100 text-text-muted">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">#</th>
                <th className="px-3 py-1.5 text-left font-medium">Nombre</th>
                <th className="px-3 py-1.5 text-left font-medium">Teléfono</th>
                <th className="px-3 py-1.5 text-left font-medium">Correo</th>
                <th className="px-3 py-1.5 text-left font-medium">Cama</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g, i) => {
                const rawGuest = Array.isArray(g.guests) ? g.guests[0] : g.guests;
                const guest = rawGuest as GuestInfo | undefined;
                const rawBed = Array.isArray(g.beds) ? g.beds[0] : g.beds;
                const bed = rawBed as BedInfo | undefined;
                const currentBed = bed?.bed_number ? `Cama ${bed.bed_number}` : "Pendiente";

                return (
                  <tr key={i} className="border-t border-border-soft">
                    <td className="px-3 py-1.5 text-text-main">{i + 1}</td>
                    <td className="px-3 py-1.5 text-text-main">{guest?.full_name ?? "—"}</td>
                    <td className="px-3 py-1.5 text-text-main">{guest?.phone ?? "—"}</td>
                    <td className="px-3 py-1.5 text-text-main">{guest?.email ?? "—"}</td>
                    <td className="px-3 py-1.5 text-text-main">
                      <BedChangeButton
                        reservationId={reservationId}
                        guestId={g.guest_id ?? ""}
                        currentBed={currentBed}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}