"use client";

import { useState } from "react";
import { createReservationAction } from "@/actions/operations";
import { ReservationGuestFields } from "@/components/forms/reservation-guest-fields";
import { Card } from "@/components/ui/card";
import { DateRangeCalendar } from "@/components/ui/date-range-calendar";
import { useReservationForm, LOCKER_DAILY_PRICE } from "@/hooks/use-reservation-form";

const NIGHTLY_RATE = 120;

export function ReceptionReservationPanel() {
  const form = useReservationForm({
    action: createReservationAction,
    reservationSource: "cashier_counter",
    returnTo: "/dashboard",
  });
  const [expanded, setExpanded] = useState(false);

  const bedTotal = form.estimatedBedTotal(NIGHTLY_RATE);
  const lockerTotal = form.estimatedLockerTotal();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await form.submitReservation();
    if (result?.ok) {
      form.resetForm();
      setExpanded(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-main sm:text-lg">Nueva reservación (recepción)</h2>
          <p className="mt-1 text-sm text-text-muted">
            Registra huéspedes con cama y locker por persona. El locker puede quedar pendiente hasta asignar número.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="w-full shrink-0 rounded-lg border border-border-soft bg-surface-soft px-3 py-2 text-sm font-medium text-text-main sm:w-auto sm:py-1.5"
        >
          {expanded ? "Ocultar formulario" : "Registrar reserva"}
        </button>
      </div>

      {expanded ? (
        <form
          className="dashboard-brand-panel mt-4 space-y-4 p-4 sm:p-6"
          onSubmit={handleSubmit}
          noValidate
        >
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-mkt-terracotta">
              Fechas de estancia
            </label>
            <DateRangeCalendar
              variant="compact"
              checkInDate={form.reservationData.check_in_date}
              checkOutDate={form.reservationData.check_out_date}
              onChange={(checkIn, checkOut) => {
                form.setReservationData((prev) => ({
                  ...prev,
                  check_in_date: checkIn,
                  check_out_date: checkOut,
                }));
                form.setTouched((prev) => ({ ...prev, check_in_date: true, check_out_date: true }));
              }}
            />
            {(form.showDateError("check_in_date") || form.showDateError("check_out_date")) && (
              <p className="mt-1 text-xs text-red-300">
                {form.dateErrors.check_in_date || form.dateErrors.check_out_date}
              </p>
            )}
          </div>

          <div className="max-w-[140px]">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-mkt-terracotta">
              Personas
            </label>
            <input
              type="number"
              min={1}
              className="w-full rounded-xl border border-mkt-border bg-white px-3 py-2 text-sm text-mkt-ink"
              value={form.guestCount}
              onChange={(e) => form.setGuestCount(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>

          <div className="space-y-3">
            {form.guests.map((guest, index) => (
              <div
                key={index}
                className="rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm"
              >
                <h3 className="mb-3 text-sm font-semibold text-white">Huésped {index + 1}</h3>
                <ReservationGuestFields
                  guest={guest}
                  guestIndex={index}
                  stayNights={form.stayNights}
                  isPrincipal={index === 0}
                  variant="marketing"
                  onChange={(field, value) => form.updateGuest(index, field, value)}
                />
              </div>
            ))}
          </div>

          <textarea
            className="min-h-20 w-full rounded-xl border border-mkt-border bg-white px-3 py-2 text-sm text-mkt-ink"
            placeholder="Notas (opcional)"
            value={form.reservationData.notes}
            onChange={(e) => form.setReservationData((prev) => ({ ...prev, notes: e.target.value }))}
          />

          <p className="text-sm text-white/75">
            Estimado: ${bedTotal.toFixed(0)} camas
            {lockerTotal > 0 ? ` + $${lockerTotal.toFixed(0)} lockers (${LOCKER_DAILY_PRICE}/día)` : ""} = $
            {(bedTotal + lockerTotal).toFixed(0)} MXN
          </p>

          {form.submitResult && !form.submitResult.success ? (
            <p className="text-sm text-red-300">{form.submitResult.message}</p>
          ) : null}

          <button
            type="submit"
            disabled={form.isSubmitting}
            className="rounded-full bg-mkt-terracotta px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-mkt-terracotta-hover disabled:opacity-50"
          >
            {form.isSubmitting ? "Registrando…" : "Crear reservación"}
          </button>
        </form>
      ) : null}
    </Card>
  );
}
