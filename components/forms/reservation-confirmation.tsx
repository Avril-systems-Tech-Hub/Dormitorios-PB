"use client";

import Link from "next/link";
import { UBICACION_SURFACE_CLASS, WHATSAPP_HREF } from "@/components/landing/constants";
import {
  formatReservationDate,
  type GuestConfirmationPayload,
} from "@/lib/guest-reservation-confirmation";

type ReservationConfirmationProps = {
  data: GuestConfirmationPayload;
  onNewReservation: () => void;
};

export function ReservationConfirmation({ data, onNewReservation }: ReservationConfirmationProps) {
  const lockerTotal = data.locker_total;
  const bedNumbers = data.guests.map((g) => g.bed_number).filter((n): n is number => typeof n === "number");

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`rounded-3xl border border-white/15 p-6 shadow-md shadow-mkt-slate-deep/20 sm:p-8 ${UBICACION_SURFACE_CLASS}`}
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <span
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"
            aria-hidden
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mkt-terracotta">Confirmación</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">¡Reservación registrada!</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/75">
            Al llegar, pasa por caja: con tu nombre, celular o correo te ubicamos en el sistema. No necesitas
            memorizar el folio.
          </p>
          <p className="mt-4 rounded-xl bg-white/10 px-4 py-2 font-mono text-lg font-semibold tracking-wide text-white">
            Folio {data.folio}
          </p>
          <p className="mt-2 max-w-sm text-xs text-white/60">
            Si lo tienes a la mano, también puedes dar este folio en recepción para pagar y hacer check-in.
          </p>
        </div>

        <section className="mb-4 rounded-2xl border border-mkt-border bg-white p-4 text-mkt-ink">
          <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-mkt-terracotta">Estancia</h4>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-mkt-ink/60">Entrada</dt>
              <dd className="font-medium">{formatReservationDate(data.check_in)}</dd>
            </div>
            <div>
              <dt className="text-mkt-ink/60">Salida</dt>
              <dd className="font-medium">{formatReservationDate(data.check_out)}</dd>
            </div>
            <div>
              <dt className="text-mkt-ink/60">Noches</dt>
              <dd className="font-medium">{data.nights}</dd>
            </div>
            <div>
              <dt className="text-mkt-ink/60">Huéspedes</dt>
              <dd className="font-medium">{data.guests.length}</dd>
            </div>
          </dl>
        </section>

        {bedNumbers.length > 0 && (
          <p className="mb-4 rounded-xl border border-emerald-200/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {bedNumbers.length === 1
              ? `Tu cama asignada: Cama ${bedNumbers[0]}.`
              : `Camas asignadas: ${bedNumbers.map((n) => `Cama ${n}`).join(", ")}.`}
          </p>
        )}

        <div className="space-y-3">
          {data.guests.map((guest, index) => (
            <section key={`${guest.phone}-${index}`} className="rounded-2xl border border-mkt-border bg-white p-4 text-mkt-ink">
              <h4 className="text-sm font-semibold">
                {index === 0 ? "Huésped principal" : `Huésped ${index + 1}`}
              </h4>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-mkt-ink/60">Nombre</dt>
                  <dd className="font-medium">{guest.full_name}</dd>
                </div>
                <div>
                  <dt className="text-mkt-ink/60">Teléfono</dt>
                  <dd className="font-medium">{guest.phone}</dd>
                </div>
                {guest.email ? (
                  <div>
                    <dt className="text-mkt-ink/60">Correo</dt>
                    <dd className="font-medium break-all">{guest.email}</dd>
                  </div>
                ) : null}
                {guest.locker_days > 0 ? (
                  <div className="sm:col-span-2">
                    <dt className="text-mkt-ink/60">Locker</dt>
                    <dd className="font-medium">
                      {guest.locker_days} día{guest.locker_days === 1 ? "" : "s"} — $
                      {guest.locker_amount.toFixed(0)} MXN
                    </dd>
                  </div>
                ) : null}
                {guest.bed_number != null ? (
                  <div>
                    <dt className="text-mkt-ink/60">Cama</dt>
                    <dd className="font-medium">Cama {guest.bed_number}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ))}
        </div>

        {data.notes ? (
          <section className="mt-4 rounded-2xl border border-mkt-border bg-white p-4 text-sm text-mkt-ink">
            <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-mkt-terracotta">Notas</h4>
            <p className="mt-2 whitespace-pre-wrap">{data.notes}</p>
          </section>
        ) : null}

        <section className="mt-4 rounded-2xl border border-white/20 bg-white/5 p-4 text-sm text-white/90">
          <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-mkt-terracotta">Resumen de pago</h4>
          <ul className="mt-3 space-y-1.5">
            <li className="flex justify-between gap-4">
              <span>
                {data.guests.length} cama{data.guests.length === 1 ? "" : "s"} × {data.nights} noche
                {data.nights === 1 ? "" : "s"}
              </span>
              <span className="shrink-0 font-medium">${data.bed_subtotal.toFixed(0)} MXN</span>
            </li>
            {lockerTotal > 0 ? (
              <li className="flex justify-between gap-4">
                <span>Locker</span>
                <span className="shrink-0 font-medium">${lockerTotal.toFixed(0)} MXN</span>
              </li>
            ) : null}
            <li className="flex justify-between gap-4 border-t border-white/15 pt-2 text-base font-semibold text-white">
              <span>Total estimado</span>
              <span>${data.total_amount.toFixed(0)} MXN</span>
            </li>
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-white/65">
            El pago es en caja al llegar. Di tu nombre, celular o correo — o tu folio si lo traes. El total final
            puede incluir descuentos aplicados en recepción.
          </p>
        </section>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onNewReservation}
            className="flex h-11 flex-1 items-center justify-center rounded-full border border-white/30 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Hacer otra reservación
          </button>
          {/*<Link
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 flex-1 items-center justify-center rounded-full bg-mkt-terracotta px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-mkt-terracotta-hover"
          >
            Contactar por WhatsApp
          </Link>*/}
        </div>
      </div>
    </div>
  );
}
