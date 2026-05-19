"use client";

import { ReservationGuestFields } from "@/components/forms/reservation-guest-fields";
import { UBICACION_SURFACE_CLASS } from "@/components/landing/constants";
import { DateRangeCalendar } from "@/components/ui/date-range-calendar";
import { useReservationForm } from "@/hooks/use-reservation-form";
import type { CreateGuestReservationResult, GuestConfirmationPayload } from "@/lib/guest-reservation-confirmation";

type ReservationFormProps = {
  action: (formData: FormData) => Promise<CreateGuestReservationResult | void>;
  onConfirmed?: (data: GuestConfirmationPayload) => void;
  beds: { bed_number: number }[];
  recurringGuest?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    sex?: string | null;
  } | null;
};

export function ReservationForm({ action, onConfirmed, beds: _beds, recurringGuest }: ReservationFormProps) {
  const form = useReservationForm({ action, onConfirmed, recurringGuest });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await form.submitReservation();
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`rounded-2xl border border-white/15 p-4 shadow-md shadow-mkt-slate-deep/20 ${UBICACION_SURFACE_CLASS}`}
      >
        <p className="text-sm font-semibold text-mkt-terracotta">Cliente recurrente</p>
        <p className="mt-1 text-xs text-white/75">Ingresa teléfono para autocompletar y aplicar descuento.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={form.searchPhone}
            onChange={(e) => form.setSearchPhone(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-mkt-border bg-white px-3 text-sm text-mkt-ink outline-none focus:border-mkt-terracotta"
            placeholder="Teléfono (ej. 7712...)"
            onKeyDown={(e) => {
              if (e.key === "Enter") void form.handleSearch();
            }}
          />
          <button
            type="button"
            onClick={() => void form.handleSearch()}
            disabled={form.isSearching}
            className="rounded-full bg-mkt-terracotta px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-mkt-terracotta-hover disabled:opacity-50"
          >
            {form.isSearching ? "Buscando..." : "Buscar"}
          </button>
        </div>
        {form.searchError ? <p className="mt-2 text-xs text-red-300">{form.searchError}</p> : null}
      </div>

      <form
        className={`rounded-3xl border border-white/15 p-4 shadow-md shadow-mkt-slate-deep/20 sm:p-6 ${UBICACION_SURFACE_CLASS}`}
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="mb-6 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-mkt-terracotta">
            Rango de fechas
          </label>
          <DateRangeCalendar
            checkInDate={form.reservationData.check_in_date}
            checkOutDate={form.reservationData.check_out_date}
            onChange={(checkIn, checkOut) => {
              form.setReservationData((prev) => ({ ...prev, check_in_date: checkIn, check_out_date: checkOut }));
              form.setTouched((prev) => ({ ...prev, check_in_date: true, check_out_date: true }));
            }}
          />
          {(form.showDateError("check_in_date") || form.showDateError("check_out_date")) && (
            <p className="mt-1 text-xs text-red-300">
              {form.dateErrors.check_in_date || form.dateErrors.check_out_date}
            </p>
          )}
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
        </div>

        <div className="space-y-4">
          <p className="text-xs text-white/70">* Nota: El huésped 1 será el huésped principal</p>
          {form.guests.map((guest, index) => (
            <div key={index} className="rounded-xl border border-mkt-border bg-white p-4">
              <h4 className="mb-3 text-sm font-semibold text-mkt-ink">Huésped {index + 1}</h4>
              <ReservationGuestFields
                guest={guest}
                guestIndex={index}
                stayNights={form.stayNights}
                isPrincipal={index === 0}
                onChange={(field, value) => form.updateGuest(index, field, value)}
              />
            </div>
          ))}
        </div>

        <textarea
          name="notes"
          className="mt-6 min-h-20 w-full rounded-xl border border-mkt-border bg-white px-3 py-2 text-sm text-mkt-ink"
          placeholder="Notas de la reservación (opcional)"
          value={form.reservationData.notes}
          onChange={(e) => form.setReservationData((prev) => ({ ...prev, notes: e.target.value }))}
        />
        <p className="mt-3 text-xs text-white/70">
          Las camas serán asignadas automáticamente al registrar tu reservación.
        </p>

        {form.submitResult && (
          <div
            className={`mt-3 rounded-lg p-3 text-sm ${form.submitResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
          >
            {form.submitResult.message}
          </div>
        )}

        <button
          type="submit"
          disabled={form.isSubmitting}
          className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-mkt-terracotta px-4 font-semibold text-white shadow-sm transition hover:bg-mkt-terracotta-hover disabled:opacity-50"
        >
          {form.isSubmitting ? "Registrando..." : "Registrar reservación"}
        </button>
      </form>
    </div>
  );
}
