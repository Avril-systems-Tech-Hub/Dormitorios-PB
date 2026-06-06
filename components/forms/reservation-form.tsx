"use client";

import { useState } from "react";
import { ReservationGuestFields } from "@/components/forms/reservation-guest-fields";
import { NIGHTLY_PRICE_MXN, UBICACION_SURFACE_CLASS } from "@/components/landing/constants";
import { DateRangeCalendar } from "@/components/ui/date-range-calendar";
import { useReservationForm } from "@/hooks/use-reservation-form";
import type { CreateGuestReservationResult, GuestConfirmationPayload } from "@/lib/guest-reservation-confirmation";
import { formatReservationDate } from "@/lib/guest-reservation-confirmation";
import { applyDiscount } from "@/lib/discount-rules";

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
  const [showReview, setShowReview] = useState(false);

  const bedTotal = form.estimatedBedTotal(NIGHTLY_PRICE_MXN);

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    setShowReview(true);
  };

  const handleSubmit = async () => {
    setShowReview(false);
    await form.submitReservation();
  };

  const panelClass = `rounded-2xl border border-white/15 p-4 shadow-md shadow-mkt-slate-deep/20 sm:p-6 ${UBICACION_SURFACE_CLASS}`;

  if (showReview) {
    return (
      <div className="flex flex-col gap-4">
        <div className={panelClass}>
          <h3 className="text-base font-semibold text-white">Revisa tu reservación</h3>
          <p className="mt-1 text-xs text-white/60">Verifica los datos antes de confirmar.</p>

          {/* Estancia */}
          <div className="mt-4 rounded-xl border border-mkt-border bg-white p-4 text-mkt-ink">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-mkt-terracotta">Estancia</h4>
              <button
                type="button"
                onClick={() => setShowReview(false)}
                className="rounded-full border border-mkt-terracotta/50 px-3 py-1 text-xs font-semibold text-mkt-terracotta transition hover:bg-mkt-terracotta/15"
              >
                ✏️ Editar
              </button>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-mkt-ink/60">Entrada</dt>
                <dd className="font-medium">
                  {form.reservationData.check_in_date
                    ? formatReservationDate(form.reservationData.check_in_date)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-mkt-ink/60">Salida</dt>
                <dd className="font-medium">
                  {form.reservationData.check_out_date
                    ? formatReservationDate(form.reservationData.check_out_date)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-mkt-ink/60">Noches</dt>
                <dd className="font-medium">{form.stayNights}</dd>
              </div>
              <div>
                <dt className="text-mkt-ink/60">Personas</dt>
                <dd className="font-medium">{form.guestCount}</dd>
              </div>
            </dl>
          </div>

          {/* Huéspedes */}
          <div className="mt-3 rounded-xl border border-mkt-border bg-white p-4 text-mkt-ink">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-mkt-terracotta">Huéspedes</h4>
              <button
                type="button"
                onClick={() => setShowReview(false)}
                className="rounded-full border border-mkt-terracotta/50 px-3 py-1 text-xs font-semibold text-mkt-terracotta transition hover:bg-mkt-terracotta/15"
              >
                ✏️ Editar
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {form.guests.map((g, i) => (
                <li key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                  <span className="text-xs font-semibold text-mkt-terracotta">
                    {i === 0 ? "Huésped principal" : `Huésped ${i + 1}`}
                  </span>
                  <p className="mt-1 font-medium text-mkt-ink">{g.full_name || "—"}</p>
                  <p className="text-xs text-mkt-ink/60">
                    {g.phone || "—"}
                    {g.email ? ` · ${g.email}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Notas */}
          {form.reservationData.notes ? (
            <div className="mt-3 rounded-xl border border-mkt-border bg-white p-4 text-sm text-mkt-ink">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-mkt-terracotta">Notas</h4>
                <button
                  type="button"
                  onClick={() => setShowReview(false)}
                  className="rounded-full border border-mkt-terracotta/50 px-3 py-1 text-xs font-semibold text-mkt-terracotta transition hover:bg-mkt-terracotta/15"
                >
                  ✏️ Editar
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{form.reservationData.notes}</p>
            </div>
          ) : null}

          {/* Resumen de pago */}
          <div className="mt-4 rounded-2xl border border-white/20 bg-white/5 p-4 text-sm text-white/90">
            <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-mkt-terracotta">Resumen de pago</h4>
            <ul className="mt-3 space-y-1.5">
              <li className="flex justify-between gap-4">
                <span>
                  {form.guestCount} cama{form.guestCount === 1 ? "" : "s"} × {form.stayNights} noche
                  {form.stayNights === 1 ? "" : "s"}
                </span>
                <span className="shrink-0 font-medium">${bedTotal.toFixed(0)} MXN</span>
              </li>
              {(() => {
                const promoDiscount = form.promoCodeResult?.valid ? form.promoCodeResult.promo : null;
                const ruleDiscount = form.applicableDiscount;
                const usePromo = promoDiscount && promoDiscount.discount_percent >= (ruleDiscount?.rule.discount_percent ?? 0);
                const activeDiscount = usePromo
                  ? { percent: promoDiscount!.discount_percent, reason: `Código promo: ${promoDiscount!.code}` }
                  : ruleDiscount
                    ? { percent: ruleDiscount.rule.discount_percent, reason: ruleDiscount.reason }
                    : null;

                if (activeDiscount) {
                  const subtotal = bedTotal;
                  const disc = applyDiscount(subtotal, activeDiscount.percent);
                  return (
                    <>
                      <li className="flex justify-between gap-4">
                        <span>Subtotal</span>
                        <span className="shrink-0">${subtotal.toFixed(0)} MXN</span>
                      </li>
                      <li className="flex justify-between gap-4 text-green-300">
                        <span>
                          Descuento ({activeDiscount.percent}%)
                          <br />
                          <span className="text-xs text-green-200/70">{activeDiscount.reason}</span>
                        </span>
                        <span className="shrink-0 font-medium">-${disc.discountAmount.toFixed(0)} MXN</span>
                      </li>
                      <li className="flex justify-between gap-4 border-t border-white/15 pt-2 text-base font-semibold text-white">
                        <span>Total con descuento</span>
                        <span>${disc.finalTotal.toFixed(0)} MXN</span>
                      </li>
                    </>
                  );
                }
                return (
                  <li className="flex justify-between gap-4 border-t border-white/15 pt-2 text-base font-semibold text-white">
                    <span>Total estimado</span>
                    <span>${bedTotal.toFixed(0)} MXN</span>
                  </li>
                );
              })()}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-white/65">
              El pago es en caja al llegar. El total final puede incluir descuentos aplicados en recepción.
            </p>
          </div>

          {form.submitResult && (
            <div
              className={`mt-3 rounded-lg p-3 text-sm ${form.submitResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
            >
              {form.submitResult.message}
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setShowReview(false)}
              className="flex h-11 flex-1 items-center justify-center rounded-full border border-white/30 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Modificar
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={form.isSubmitting}
              className="flex h-11 flex-[2] items-center justify-center rounded-full bg-mkt-terracotta px-4 font-semibold text-white shadow-sm transition hover:bg-mkt-terracotta-hover disabled:opacity-50"
            >
              {form.isSubmitting ? "Registrando..." : "Confirmar reservación"}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        onSubmit={handleReview}
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

        {/* Código de descuento */}
        <div className="mt-6 rounded-xl border border-mkt-border bg-white p-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-mkt-terracotta">
            ¿Tienes un código de descuento?
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 rounded-lg border border-mkt-border bg-white px-3 py-2 text-sm uppercase tracking-wider text-mkt-ink placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-400"
              placeholder="Escribe tu código aquí"
              value={form.promoCodeInput}
              onChange={(e) => form.setPromoCodeInput(e.target.value.toUpperCase())}
              maxLength={20}
            />
            <button
              type="button"
              className="rounded-lg bg-mkt-terracotta px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={form.promoCodeValidating || form.promoCodeInput.length < 3}
              onClick={() => form.validatePromo(form.promoCodeInput)}
            >
              {form.promoCodeValidating ? "..." : "Aplicar"}
            </button>
            {form.promoCodeResult?.valid && (
              <button
                type="button"
                className="rounded-lg border border-mkt-border px-3 py-2 text-sm text-red-600"
                onClick={form.clearPromoCode}
              >
                ✕
              </button>
            )}
          </div>
          {form.promoCodeResult?.valid && form.promoCodeResult.promo && (
            <p className="mt-2 text-xs text-emerald-700">
              ✓ Código <strong>{form.promoCodeResult.promo.code}</strong> válido — {form.promoCodeResult.promo.discount_percent}% de descuento
            </p>
          )}
          {form.promoCodeResult && !form.promoCodeResult.valid && form.promoCodeInput.length >= 3 && (
            <p className="mt-2 text-xs text-red-600">
              {form.promoCodeResult.error || "Código inválido."}
            </p>
          )}
        </div>

        <textarea
          name="notes"
          className="mt-6 min-h-20 w-full rounded-xl border border-mkt-border bg-white px-3 py-2 text-sm text-mkt-ink"
          placeholder="Notas de la reservación (opcional)"
          value={form.reservationData.notes}
          onChange={(e) => form.setReservationData((prev) => ({ ...prev, notes: e.target.value }))}
        />
        <p className="mt-3 text-xs text-white/70">
          Las camas se asignan en recepción al llegar. Si necesitas locker, solicítalo al hacer check-in.
        </p>

        {form.submitResult && !form.submitResult.success && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {form.submitResult.message}
          </div>
        )}

        <button
          type="submit"
          className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-mkt-terracotta px-4 font-semibold text-white shadow-sm transition hover:bg-mkt-terracotta-hover disabled:opacity-50"
        >
          Revisar reservación
        </button>
      </form>
    </div>
  );
}