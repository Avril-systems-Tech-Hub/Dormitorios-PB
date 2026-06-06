"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { applyDiscount } from "@/lib/discount-rules";
import { ReservationConfirmation } from "@/components/forms/reservation-confirmation";
import { ReservationGuestFields } from "@/components/forms/reservation-guest-fields";
import { NIGHTLY_PRICE_MXN, UBICACION_SURFACE_CLASS } from "@/components/landing/constants";
import { DateRangeCalendar } from "@/components/ui/date-range-calendar";
import { useReservationForm, validateGuestRow, LOCKER_DAILY_PRICE } from "@/hooks/use-reservation-form";
import type { CreateGuestReservationResult, GuestConfirmationPayload } from "@/lib/guest-reservation-confirmation";
import { formatReservationDate } from "@/lib/guest-reservation-confirmation";

type WizardStepId = "returning" | "stay" | "principal" | "additional" | "notes" | "summary";

function buildStepOrder(guestCount: number, recurringGuestMatched: boolean): WizardStepId[] {
  if (recurringGuestMatched) {
    const steps: WizardStepId[] = ["returning"];
    if (guestCount > 1) steps.push("additional");
    steps.push("notes", "summary");
    return steps;
  }
  const steps: WizardStepId[] = ["returning", "stay", "principal"];
  if (guestCount > 1) steps.push("additional");
  steps.push("notes", "summary");
  return steps;
}

function formatGuestSex(value: string) {
  const labels: Record<string, string> = {
    f: "Femenino",
    m: "Masculino",
    x: "Otro",
  };
  return labels[value] ?? "No indicado";
}

function validateStayFields(form: ReturnType<typeof useReservationForm>): string | null {
  if (form.hasDateErrors) {
    form.setTouched((p) => ({ ...p, check_in_date: true, check_out_date: true }));
    return form.dateErrors.check_in_date || form.dateErrors.check_out_date || "Revisa las fechas.";
  }
  if (form.guestCount < 1) return "Indica al menos una persona.";
  return null;
}

const STEP_LABELS: Record<WizardStepId, string> = {
  returning: "¿Ya te hospedaste?",
  stay: "Tu estancia",
  principal: "Huésped principal",
  additional: "Más huéspedes",
  notes: "Notas",
  summary: "Resumen",
};

type ReservationWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: (formData: FormData) => Promise<CreateGuestReservationResult | void>;
};

export function ReservationWizard({ open, onOpenChange, action }: ReservationWizardProps) {
  const [mounted, setMounted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [additionalGuestIndex, setAdditionalGuestIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<GuestConfirmationPayload | null>(null);

  const form = useReservationForm({
    action,
    onConfirmed: (data) => setConfirmation(data),
    allowLockerSelection: true,
  });
  const { resetForm } = form;

  const stepOrder = useMemo(
    () => buildStepOrder(form.guestCount, form.recurringGuestMatched),
    [form.guestCount, form.recurringGuestMatched],
  );
  const currentStep = stepOrder[stepIndex] ?? "returning";
  const totalSteps = stepOrder.length;

  const stepTitle = useMemo(() => {
    if (confirmation) return "Confirmación";
    if (currentStep === "returning" && form.recurringGuestMatched) {
      const name = form.guests[0]?.full_name?.trim();
      if (!name) return "Bienvenido de nuevo";
      const firstName = name.split(/\s+/)[0];
      return `Bienvenido, ${firstName}`;
    }
    return STEP_LABELS[currentStep];
  }, [confirmation, currentStep, form.recurringGuestMatched, form.guests]);

  const resetWizard = useCallback(() => {
    setStepIndex(0);
    setAdditionalGuestIndex(0);
    setStepError(null);
    setConfirmation(null);
    resetForm();
  }, [resetForm]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    const t = window.setTimeout(resetWizard, 300);
    return () => window.clearTimeout(t);
  }, [open, resetWizard]);

  useEffect(() => {
    if (stepIndex >= stepOrder.length) {
      setStepIndex(Math.max(0, stepOrder.length - 1));
    }
  }, [stepOrder.length, stepIndex]);

  const handleClose = () => {
    if (confirmation) {
      onOpenChange(false);
      return;
    }
    const hasData =
      form.reservationData.check_in_date ||
      form.guests.some((g) => g.full_name || g.phone) ||
      form.searchPhone;
    if (hasData && !window.confirm("¿Salir sin terminar la reservación?")) return;
    onOpenChange(false);
  };

  const validateCurrentStep = (): boolean => {
    setStepError(null);
    switch (currentStep) {
      case "returning": {
        if (form.recurringGuestMatched) {
          const stayErr = validateStayFields(form);
          if (stayErr) {
            setStepError(stayErr);
            return false;
          }
          const guestErr = validateGuestRow(form.guests[0]);
          if (guestErr) {
            setStepError(guestErr);
            return false;
          }
        }
        return true;
      }
      case "stay": {
        const stayErr = validateStayFields(form);
        if (stayErr) {
          setStepError(stayErr);
          return false;
        }
        return true;
      }
      case "principal": {
        const err = validateGuestRow(form.guests[0]);
        if (err) {
          setStepError(err);
          return false;
        }
        return true;
      }
      case "additional": {
        const guestIdx = additionalGuestIndex + 1;
        const err = validateGuestRow(form.guests[guestIdx]);
        if (err) {
          setStepError(err);
          return false;
        }
        return true;
      }
      case "notes":
      case "summary":
        return true;
      default:
        return true;
    }
  };

  const goNext = async () => {
    if (!validateCurrentStep()) return;

    if (currentStep === "additional" && additionalGuestIndex < form.guestCount - 2) {
      setAdditionalGuestIndex((i) => i + 1);
      setStepError(null);
      return;
    }

    if (currentStep === "summary") {
      const result = await form.submitReservation();
      if (result.ok === false && result.message) {
        setStepError(result.message);
      }
      return;
    }

    if (stepIndex < totalSteps - 1) {
      setStepIndex((i) => i + 1);
      if (currentStep !== "additional") setAdditionalGuestIndex(0);
    }
  };

  const goBack = () => {
    setStepError(null);
    if (currentStep === "additional" && additionalGuestIndex > 0) {
      setAdditionalGuestIndex((i) => i - 1);
      return;
    }
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
      if (stepOrder[stepIndex - 1] === "additional") {
        setAdditionalGuestIndex(Math.max(0, form.guestCount - 2));
      }
    }
  };

  const progress = ((stepIndex + 1) / totalSteps) * 100;
  const additionalGuestNumber = additionalGuestIndex + 2;
  const bedTotal = form.estimatedBedTotal(NIGHTLY_PRICE_MXN);
  const lockerTotal = form.estimatedLockerTotal();

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-mkt-slate-deep"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-wizard-title"
    >
      <header className="safe-area-pt-header shrink-0 border-b border-white/10 bg-mkt-slate-deep/95 px-4 pb-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mkt-terracotta">
              Paso {stepIndex + 1} de {totalSteps}
            </p>
            <h2 id="reservation-wizard-title" className="truncate text-sm font-semibold text-white">
              {stepTitle}
            </h2>
          </div>
          <div className="h-10 w-10" aria-hidden />
        </div>
        {!confirmation ? (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-mkt-terracotta transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:py-4">
        <div className="mx-auto w-full md:max-w-lg lg:max-w-xl">
          {confirmation ? (
            <ReservationConfirmation
              data={confirmation}
              onNewReservation={() => {
                resetWizard();
              }}
            />
          ) : (
            <WizardStepContent
              step={currentStep}
              form={form}
              additionalGuestIndex={additionalGuestIndex}
              additionalGuestNumber={additionalGuestNumber}
              bedTotal={bedTotal}
              lockerTotal={lockerTotal}
              stepError={stepError}
              goToStep={(stepId) => {
                const idx = stepOrder.indexOf(stepId);
                if (idx >= 0) setStepIndex(idx);
              }}
            />
          )}
        </div>
      </div>

      {!confirmation ? (
        <footer className="safe-area-pb-footer shrink-0 border-t border-white/10 bg-mkt-slate-deep/95 px-4 pt-3 backdrop-blur-md md:px-6">
          <div className="mx-auto w-full md:max-w-lg lg:max-w-xl">
          {(stepError || (form.submitResult && !form.submitResult.success)) ? (
            <p className="mb-2 text-center text-xs text-red-300">
              {stepError || form.submitResult?.message}
            </p>
          ) : null}
          <div className="flex gap-3">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="flex h-12 flex-1 items-center justify-center rounded-full border border-white/30 text-sm font-semibold text-white"
              >
                Atrás
              </button>
            ) : null}
            <button
              type="button"
              onClick={goNext}
              disabled={form.isSubmitting}
              className={`flex h-12 items-center justify-center rounded-full bg-mkt-terracotta text-sm font-semibold text-white shadow-sm disabled:opacity-50 ${stepIndex > 0 ? "flex-[2]" : "w-full"}`}
            >
              {form.isSubmitting
                ? "Registrando..."
                : currentStep === "summary"
                  ? "Confirmar reservación"
                  : currentStep === "additional" && additionalGuestIndex < form.guestCount - 2
                    ? `Siguiente huésped (${additionalGuestNumber + 1}/${form.guestCount})`
                    : "Continuar"}
            </button>
          </div>
          </div>
        </footer>
      ) : (
        <footer className="safe-area-pb-footer shrink-0 border-t border-white/10 px-4 pt-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-12 w-full items-center justify-center rounded-full bg-mkt-terracotta text-sm font-semibold text-white"
          >
            Listo
          </button>
        </footer>
      )}
    </div>,
    document.body,
  );
}

function WizardStepContent({
  step,
  form,
  additionalGuestIndex,
  additionalGuestNumber,
  bedTotal,
  lockerTotal,
  stepError,
  goToStep,
}: {
  step: WizardStepId;
  form: ReturnType<typeof useReservationForm>;
  additionalGuestIndex: number;
  additionalGuestNumber: number;
  bedTotal: number;
  lockerTotal: number;
  stepError: string | null;
  goToStep: (stepId: WizardStepId) => void;
}) {
  const panelClass = `rounded-2xl border border-white/15 p-4 shadow-md shadow-mkt-slate-deep/20 md:p-6 ${UBICACION_SURFACE_CLASS}`;

  switch (step) {
    case "returning":
      if (form.recurringGuestMatched) {
        const guest = form.guests[0];
        return (
          <div className="space-y-5">
            <div className={panelClass}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mkt-terracotta">
                Cliente recurrente
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                ¡Bienvenido{guest.full_name ? `, ${guest.full_name}` : ""}!
              </h3>
              <p className="mt-1 text-sm text-white/75">
                Tus datos están listos. Elige las fechas de tu próxima estancia.
              </p>
              <dl className="mt-4 space-y-2 rounded-xl border border-white/15 bg-white/5 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-white/60">Teléfono</dt>
                  <dd className="font-medium text-white">{guest.phone || "—"}</dd>
                </div>
                {guest.email ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-white/60">Correo</dt>
                    <dd className="break-all text-right font-medium text-white">{guest.email}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-white/60">Sexo</dt>
                  <dd className="font-medium text-white">{formatGuestSex(guest.sex)}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={form.clearRecurringGuest}
                className="mt-3 text-xs font-medium text-mkt-terracotta underline-offset-2 hover:underline"
              >
                No soy yo / usar otro número
              </button>
            </div>
            <WizardStayDateFields form={form} panelClass={panelClass} />
            <div className={panelClass}>
              <h3 className="text-base font-semibold text-white">Locker (opcional)</h3>
              <p className="mt-1 text-xs text-white/70">
                Puedes reservar locker por día. El número físico se asigna en recepción.
              </p>
              <div className="mt-4">
                <ReservationGuestFields
                  guest={guest}
                  guestIndex={0}
                  stayNights={form.stayNights}
                  showIdentityFields={false}
                  showLockerFields
                  onChange={(field, value) => form.updateGuest(0, field, value)}
                />
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className="space-y-5">
          <WizardHeroImage src="/marketing/ad-descansar.png" alt="Descanso en Dormitorios Plaza Basílica" />
          <div className={panelClass}>
            <p className="text-sm text-white/80">
              Si ya te hospedaste con nosotros, busca por teléfono para autocompletar tus datos.
            </p>
            <div className="mt-4 flex gap-2">
              <input
                value={form.searchPhone}
                onChange={(e) => form.setSearchPhone(e.target.value)}
                className="h-11 flex-1 rounded-lg border border-mkt-border bg-white px-3 text-sm text-mkt-ink outline-none focus:border-mkt-terracotta"
                placeholder="Teléfono (ej. 7712...)"
                type="tel"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void form.handleSearch();
                }}
              />
              <button
                type="button"
                onClick={() => void form.handleSearch()}
                disabled={form.isSearching}
                className="shrink-0 rounded-full bg-mkt-terracotta px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {form.isSearching ? "…" : "Buscar"}
              </button>
            </div>
            {form.searchError ? <p className="mt-2 text-xs text-red-300">{form.searchError}</p> : null}
          </div>
          <p className="text-center text-xs text-white/60">También puedes continuar sin buscar.</p>
        </div>
      );

    case "stay":
      return (
        <div className="space-y-5">
          <WizardHeroImage
            className="md:hidden"
            src="/marketing/ubicacion-facade.png"
            alt="Ubicación Dormitorios Plaza Basílica"
          />
          <WizardStayDateFields form={form} panelClass={panelClass} />
        </div>
      );

    case "principal":
      return (
        <div className="space-y-4">
          <div className={panelClass}>
            <h3 className="text-base font-semibold text-white">Huésped principal</h3>
            <div className="mt-4">
              <ReservationGuestFields
                guest={form.guests[0]}
                guestIndex={0}
                stayNights={form.stayNights}
                isPrincipal
                showLockerFields
                onChange={(field, value) => form.updateGuest(0, field, value)}
              />
            </div>
          </div>
        </div>
      );

    case "additional": {
      const guestIdx = additionalGuestIndex + 1;
      const guest = form.guests[guestIdx];
      if (!guest) return null;
      return (
        <div className="space-y-4">
          <div className={panelClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mkt-terracotta">
              Huésped {additionalGuestNumber} de {form.guestCount}
            </p>
            <div className="mt-4">
              <ReservationGuestFields
                guest={guest}
                guestIndex={guestIdx}
                stayNights={form.stayNights}
                showLockerFields
                onChange={(field, value) => form.updateGuest(guestIdx, field, value)}
              />
            </div>
          </div>
        </div>
      );
    }

    case "notes":
      return (
        <div className={panelClass}>
          <h3 className="text-base font-semibold text-white">Notas (opcional)</h3>

          {/* Código de descuento */}
          <div className="mt-4 rounded-xl border border-mkt-border bg-white p-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-mkt-terracotta">
              ¿Tienes un código de descuento?
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-lg border border-mkt-border bg-white px-3 py-2 text-sm uppercase tracking-wider text-mkt-ink placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-400"
                placeholder="Tu código aquí"
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
                ✓ <strong>{form.promoCodeResult.promo.code}</strong> — {form.promoCodeResult.promo.discount_percent}% descuento
              </p>
            )}
            {form.promoCodeResult && !form.promoCodeResult.valid && form.promoCodeInput.length >= 3 && (
              <p className="mt-2 text-xs text-red-600">
                {form.promoCodeResult.error || "Código inválido."}
              </p>
            )}
          </div>

          <textarea
            className="mt-4 min-h-28 w-full rounded-xl border border-mkt-border bg-white px-3 py-2.5 text-sm text-mkt-ink"
            placeholder="Ej. llegamos en grupo, necesitamos camas juntas…"
            value={form.reservationData.notes}
            onChange={(e) =>
              form.setReservationData((prev) => ({ ...prev, notes: e.target.value }))
            }
          />
          <p className="mt-3 text-xs text-white/70">
            Las camas se asignan en recepción al llegar. Si contrataste locker, te asignamos el número al
            hacer check-in.
          </p>
        </div>
      );

    case "summary": {
      const editBtnClass =
        "rounded-full border border-mkt-terracotta/50 px-3 py-1 text-xs font-semibold text-mkt-terracotta transition hover:bg-mkt-terracotta/15";
      return (
        <div className="space-y-4">
          {/* Estancia y precios */}
          <div className={panelClass}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Estancia</h3>
              <button type="button" className={editBtnClass} onClick={() => goToStep(form.recurringGuestMatched ? "returning" : "stay")}>
                ✏️ Editar
              </button>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
                <dt className="text-white/65">Entrada</dt>
                <dd className="font-medium text-white">
                  {form.reservationData.check_in_date
                    ? formatReservationDate(form.reservationData.check_in_date)
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
                <dt className="text-white/65">Salida</dt>
                <dd className="font-medium text-white">
                  {form.reservationData.check_out_date
                    ? formatReservationDate(form.reservationData.check_out_date)
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
                <dt className="text-white/65">Noches</dt>
                <dd className="font-medium text-white">{form.stayNights}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
                <dt className="text-white/65">Huéspedes</dt>
                <dd className="font-medium text-white">{form.guestCount}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
                <dt className="text-white/65">Camas</dt>
                <dd className="font-medium text-white">
                  ${bedTotal.toFixed(0)} MXN
                </dd>
              </div>
              {lockerTotal > 0 ? (
                <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
                  <dt className="text-white/65">Locker</dt>
                  <dd className="font-medium text-white">${lockerTotal.toFixed(0)} MXN</dd>
                </div>
              ) : null}
              {(() => {
                const promoDiscount = form.promoCodeResult?.valid ? form.promoCodeResult.promo : null;
                const ruleDiscount = form.applicableDiscount;
                const usePromo = promoDiscount && promoDiscount.discount_percent >= (ruleDiscount?.rule.discount_percent ?? 0);
                const activeDiscount = usePromo
                  ? { percent: promoDiscount!.discount_percent, reason: `Código promo: ${promoDiscount!.code}` }
                  : ruleDiscount
                    ? { percent: ruleDiscount.rule.discount_percent, reason: ruleDiscount.reason }
                    : null;

                const subtotal = bedTotal + lockerTotal;

                if (activeDiscount) {
                  const discountedBeds = applyDiscount(bedTotal, activeDiscount.percent).finalTotal;
                  const discountedLockers = form.estimatedLockerTotal(activeDiscount.percent);
                  const finalTotal = discountedBeds + discountedLockers;
                  const discountAmount = subtotal - finalTotal;
                  return (
                    <>
                      <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
                        <dt className="text-white/65">Subtotal</dt>
                        <dd className="font-medium text-white">${subtotal.toFixed(0)} MXN</dd>
                      </div>
                      <div className="flex justify-between gap-3 border-b border-white/10 pb-3 text-green-300">
                        <dt>
                          Descuento ({activeDiscount.percent}%)
                          <br />
                          <span className="text-xs text-green-200/70">{activeDiscount.reason}</span>
                        </dt>
                        <dd className="font-medium">-${discountAmount.toFixed(0)} MXN</dd>
                      </div>
                      <div className="flex justify-between gap-3 pt-1 text-base">
                        <dt className="font-semibold text-white">Total con descuento</dt>
                        <dd className="font-semibold text-mkt-terracotta">${finalTotal.toFixed(0)} MXN</dd>
                      </div>
                    </>
                  );
                }
                return (
                  <div className="flex justify-between gap-3 pt-1 text-base">
                    <dt className="font-semibold text-white">Total estimado</dt>
                    <dd className="font-semibold text-mkt-terracotta">
                      ${subtotal.toFixed(0)} MXN
                    </dd>
                  </div>
                );
              })()}
            </dl>
            <p className="mt-4 text-xs text-white/60">
              Pago en caja al llegar. El total final puede incluir descuentos en recepción.
            </p>
          </div>

          {/* Huéspedes */}
          <div className={panelClass}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Huéspedes</h3>
              <button type="button" className={editBtnClass} onClick={() => goToStep(form.recurringGuestMatched ? "returning" : form.guestCount > 1 ? "additional" : "principal")}>
                ✏️ Editar
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {form.guests.map((g, i) => (
                <li key={i} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/90">
                  <span className="text-xs font-semibold text-mkt-terracotta">
                    {i === 0 ? "Principal" : `Huésped ${i + 1}`}
                  </span>
                  <p className="mt-1 font-medium">{g.full_name || "—"}</p>
                  <p className="text-xs text-white/60">{g.phone || "—"}{g.email ? ` · ${g.email}` : ""}</p>
                  {g.add_locker === "yes" ? (
                    <p className="mt-1 text-xs text-white/75">
                      Locker: {g.locker_days} día{g.locker_days === 1 ? "" : "s"} · $
                      {(g.locker_days * LOCKER_DAILY_PRICE).toFixed(0)} MXN
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          {/* Notas */}
          <div className={panelClass}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Notas</h3>
              <button type="button" className={editBtnClass} onClick={() => goToStep("notes")}>
                ✏️ Editar
              </button>
            </div>
            <p className="mt-2 text-sm text-white/80">
              {form.reservationData.notes || <span className="italic text-white/50">Sin notas</span>}
            </p>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

/** @deprecated Use ReservationWizard */
export const ReservationMobileWizard = ReservationWizard;

function WizardStayDateFields({
  form,
  panelClass,
}: {
  form: ReturnType<typeof useReservationForm>;
  panelClass: string;
}) {
  const onDatesChange = (checkIn: string, checkOut: string) => {
    form.setReservationData((prev) => ({
      ...prev,
      check_in_date: checkIn,
      check_out_date: checkOut,
    }));
    form.setTouched((prev) => ({ ...prev, check_in_date: true, check_out_date: true }));
  };

  return (
    <div className={panelClass}>
      <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-mkt-terracotta md:text-sm">
        Rango de fechas
      </label>
      <div className="mt-3 md:hidden">
        <DateRangeCalendar
          variant="compact"
          checkInDate={form.reservationData.check_in_date}
          checkOutDate={form.reservationData.check_out_date}
          onChange={onDatesChange}
        />
      </div>
      <div className="mt-3 hidden md:block">
        <DateRangeCalendar
          variant="default"
          checkInDate={form.reservationData.check_in_date}
          checkOutDate={form.reservationData.check_out_date}
          onChange={onDatesChange}
        />
      </div>
      {(form.showDateError("check_in_date") || form.showDateError("check_out_date")) && (
        <p className="mt-2 text-xs text-red-300">
          {form.dateErrors.check_in_date || form.dateErrors.check_out_date}
        </p>
      )}
      <div className="mt-5">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-mkt-terracotta">
          Personas (camas)
        </label>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          className="w-full max-w-[160px] rounded-xl border border-mkt-border bg-white px-3 py-2.5 text-sm text-mkt-ink md:max-w-xs"
          value={form.guestCount}
          onChange={(e) => {
            const n = Math.max(1, Number(e.target.value) || 1);
            form.setGuestCount(n);
          }}
        />
        <p className="mt-2 text-xs text-white/65">
          Una cama por persona. La asignación se hace en recepción.
        </p>
      </div>
    </div>
  );
}

function WizardHeroImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div
      className={`mx-auto max-w-[220px] overflow-hidden rounded-2xl border border-white/15 bg-mkt-canvas p-2 shadow-lg ${className ?? ""}`}
    >
      <Image src={src} alt={alt} width={220} height={160} className="h-auto w-full rounded-xl object-cover" />
    </div>
  );
}
