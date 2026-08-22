"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  assignLockerAction,
  completeReceptionCheckInAction,
  getReceptionReservationDetailAction,
  listRecentReservationsForReceptionAction,
  reassignBedAction,
  resendPaymentReceiptAction,
  searchReservationsForReceptionAction,
} from "@/actions/operations";
import {
  buildGuestAssignmentDrafts,
  ReceptionGuestAssignmentPanel,
  validateGuestAssignmentDrafts,
  type GuestAssignmentDraft,
} from "@/components/dashboard/reception-guest-assignment-panel";
import {
  ReceptionReservationList,
  ReceptionRecentLimitFilter,
  ReceptionSearchModeToggle,
  type ReceptionSearchMode,
} from "@/components/dashboard/reception-reservation-list";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  buildReceptionDashboardPath,
  DEFAULT_RECENT_RESERVATION_LIMIT,
  getReceptionLockerTotal,
  parseReceptionListMode,
  RECEPTION_RESERVATION_PARAM,
  RECEPTION_STEP_LABELS,
  RECEPTION_WIZARD_STEPS,
  type RecentReservationLimit,
  type ReceptionSearchResult,
  type ReceptionWizardStep,
} from "@/lib/reception-check-in";
import type { PaymentMethod } from "@/types/domain";

type WizardStepId = ReceptionWizardStep | "success";

const STEP_ORDER: ReceptionWizardStep[] = [...RECEPTION_WIZARD_STEPS];

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

type ReceptionCheckInWizardProps = {
  initialRecentReservations?: ReceptionSearchResult[];
  initialReservation?: ReceptionSearchResult;
  initialReservationError?: string;
};

export function ReceptionCheckInWizard({
  initialRecentReservations = [],
  initialReservation,
  initialReservationError,
}: ReceptionCheckInWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlListMode = parseReceptionListMode(searchParams.get("reception"));
  const reservationParam = searchParams.get(RECEPTION_RESERVATION_PARAM);
  const [stepIndex, setStepIndex] = useState(initialReservation ? 1 : 0);
  const [stepError, setStepError] = useState<string | null>(initialReservationError ?? null);
  const [searchMode, setSearchMode] = useState<ReceptionSearchMode>(urlListMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ReceptionSearchResult[]>([]);
  const [recentReservations, setRecentReservations] = useState(initialRecentReservations);
  const [recentLimit, setRecentLimit] = useState<RecentReservationLimit>(DEFAULT_RECENT_RESERVATION_LIMIT);
  const [selected, setSelected] = useState<ReceptionSearchResult | null>(initialReservation ?? null);
  const [cashReceived, setCashReceived] = useState(
    initialReservation ? initialReservation.balanceDue <= 0 : false,
  );
  const [paymentAmount, setPaymentAmount] = useState(
    initialReservation && initialReservation.balanceDue > 0
      ? String(initialReservation.balanceDue)
      : "",
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, GuestAssignmentDraft>>(
    initialReservation ? buildGuestAssignmentDrafts(initialReservation.guests) : {},
  );
  const [successState, setSuccessState] = useState<{
    message: string;
    whatsappSent: boolean;
    balanceDue: number;
    folioId: string;
    skippedPayment: boolean;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [appliedInitialReservationId, setAppliedInitialReservationId] = useState(
    initialReservation?.reservationId ?? null,
  );
  const [appliedInitialReservationError, setAppliedInitialReservationError] = useState(
    initialReservationError ?? null,
  );
  const [pendingReservationId, setPendingReservationId] = useState<string | null>(null);

  if (initialReservation && initialReservation.reservationId !== appliedInitialReservationId) {
    setAppliedInitialReservationId(initialReservation.reservationId);
    setSelected(initialReservation);
    setPaymentAmount(
      initialReservation.balanceDue > 0 ? String(initialReservation.balanceDue) : "",
    );
    setCashReceived(initialReservation.balanceDue <= 0);
    setAssignmentDrafts(buildGuestAssignmentDrafts(initialReservation.guests));
    setSuccessState(null);
    setStepError(null);
    setStepIndex(1);
  }

  if (initialReservationError && initialReservationError !== appliedInitialReservationError) {
    setAppliedInitialReservationError(initialReservationError);
    setStepError(initialReservationError);
  }

  if (reservationParam && pendingReservationId && reservationParam === pendingReservationId) {
    setPendingReservationId(null);
  }

  if (
    !reservationParam &&
    !pendingReservationId &&
    (selected || appliedInitialReservationId || stepIndex > 0 || successState)
  ) {
    setSelected(null);
    setAppliedInitialReservationId(null);
    setStepIndex(0);
    setSuccessState(null);
    setCashReceived(false);
    setPaymentAmount("");
    setAssignmentDrafts({});
    setStepError(null);
  }

  const currentStep: WizardStepId = successState ? "success" : STEP_ORDER[stepIndex] ?? "search";
  const progressStep = successState ? STEP_ORDER.length : stepIndex + 1;
  const lockerTotal = selected ? getReceptionLockerTotal(selected.guests) : 0;
  const bedPortion = selected
    ? Math.max(0, Number((selected.totalAmount - lockerTotal).toFixed(2)))
    : 0;

  useEffect(() => {
    setSearchMode(urlListMode);
  }, [urlListMode]);

  async function refreshRecentReservations(limit = recentLimit) {
    const response = await listRecentReservationsForReceptionAction(limit);
    if (response.success) {
      setRecentReservations(response.results);
    }
  }

  function handleRecentLimitChange(limit: RecentReservationLimit) {
    setRecentLimit(limit);
    setStepError(null);
    startTransition(async () => {
      await refreshRecentReservations(limit);
    });
  }

  function pushReceptionView(patch: {
    listMode?: ReceptionSearchMode | null;
    reservationId?: string | null;
  }) {
    router.push(buildReceptionDashboardPath(searchParams, patch), { scroll: false });
  }

  function resetWizard() {
    setStepIndex(0);
    setStepError(null);
    setSearchQuery("");
    setSearchResults([]);
    setSelected(null);
    setCashReceived(false);
    setPaymentAmount("");
    setPaymentMethod("cash");
    setAssignmentDrafts({});
    setSuccessState(null);
    setPendingReservationId(null);
    void refreshRecentReservations();
    pushReceptionView({ listMode: searchMode, reservationId: null });
  }

  function handleSearchModeChange(mode: ReceptionSearchMode) {
    if (mode === searchMode) return;
    setSearchMode(mode);
    setStepError(null);
    pushReceptionView({ listMode: mode, reservationId: null });
    if (mode === "recent") {
      void refreshRecentReservations();
    }
  }

  function selectReservation(reservation: ReceptionSearchResult) {
    setPendingReservationId(reservation.reservationId);
    setAppliedInitialReservationId(reservation.reservationId);
    setSelected(reservation);
    setPaymentAmount(reservation.balanceDue > 0 ? String(reservation.balanceDue) : "");
    setCashReceived(reservation.balanceDue <= 0);
    setAssignmentDrafts(buildGuestAssignmentDrafts(reservation.guests));
    setStepError(null);
    setStepIndex(1);
    pushReceptionView({
      listMode: searchMode,
      reservationId: reservation.reservationId,
    });
  }

  function returnToReservationList() {
    setPendingReservationId(null);
    setSelected(null);
    setSearchResults([]);
    setStepIndex(0);
    setStepError(null);
    pushReceptionView({ reservationId: null });
  }

  function updateAssignmentDraft(guestId: string, patch: Partial<GuestAssignmentDraft>) {
    setAssignmentDrafts((prev) => ({
      ...prev,
      [guestId]: {
        bedId: prev[guestId]?.bedId ?? null,
        lockerNumber: prev[guestId]?.lockerNumber ?? "",
        ...patch,
      },
    }));
  }

  async function persistGuestAssignments(
    reservation: ReceptionSearchResult,
    drafts: Record<string, GuestAssignmentDraft>,
  ): Promise<{ ok: true; reservation: ReceptionSearchResult } | { ok: false; message: string }> {
    let working = reservation;

    for (const guest of working.guests) {
      const draft = drafts[guest.guestId];
      if (!draft) {
        return { ok: false, message: `Faltan datos de asignación para ${guest.fullName}.` };
      }

      if (draft.bedId && draft.bedId !== guest.bedId) {
        const fd = new FormData();
        fd.set("reservation_id", working.reservationId);
        fd.set("guest_id", guest.guestId);
        fd.set("new_bed_id", draft.bedId);
        const bedResult = await reassignBedAction(fd);
        if (bedResult.status === "error") {
          return { ok: false, message: bedResult.message };
        }
        const refreshed = await refreshSelected(working.reservationId);
        if (refreshed) working = refreshed;
      }

      const refreshedGuest = working.guests.find((g) => g.guestId === guest.guestId) ?? guest;
      const lockerNumber = draft.lockerNumber.trim();

      // Always re-apply locker service when days > 0 so locker_amount + folio totals stay in sync.
      if (refreshedGuest.lockerDays > 0 && lockerNumber) {
        const fd = new FormData();
        fd.set("reservation_id", working.reservationId);
        fd.set("guest_id", refreshedGuest.guestId);
        fd.set("add_locker", "yes");
        fd.set("locker_days", String(refreshedGuest.lockerDays));
        fd.set("locker_number", lockerNumber);
        const lockerResult = await assignLockerAction(fd);
        if (lockerResult.status === "error") {
          return { ok: false, message: lockerResult.message };
        }
        const refreshed = await refreshSelected(working.reservationId);
        if (refreshed) working = refreshed;
      }
    }

    return { ok: true, reservation: working };
  }

  async function refreshSelected(reservationId: string) {
    const detail = await getReceptionReservationDetailAction(reservationId);
    if (detail.success && detail.result) {
      setSelected(detail.result);
      setPaymentAmount(
        detail.result.balanceDue > 0 ? String(detail.result.balanceDue) : "",
      );
      setCashReceived(detail.result.balanceDue <= 0);
    }
    return detail.result ?? null;
  }

  function goBack() {
    setStepError(null);
    if (stepIndex <= 0) return;
    if (stepIndex === 1) {
      returnToReservationList();
      return;
    }
    setStepIndex((i) => i - 1);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setStepError(null);
    startTransition(async () => {
      const response = await searchReservationsForReceptionAction(searchQuery);
      if (!response.success) {
        setStepError(response.message ?? "Error al buscar.");
        return;
      }
      setSearchResults(response.results);
      if (response.results.length === 0) {
        setStepError("No se encontró ninguna reservación. Verifica los datos o crea una reserva nueva.");
      } else if (response.results.length === 1) {
        selectReservation(response.results[0]);
      }
    });
  }

  function goNextFromAssign() {
    if (!selected) return;
    const assignmentError = validateGuestAssignmentDrafts(selected.guests, assignmentDrafts);
    if (assignmentError) {
      setStepError(assignmentError);
      return;
    }

    setStepError(null);
    startTransition(async () => {
      const assignmentResult = await persistGuestAssignments(selected, assignmentDrafts);
      if (!assignmentResult.ok) {
        setStepError(assignmentResult.message);
        return;
      }

      const latest = assignmentResult.reservation;
      setSelected(latest);
      setAssignmentDrafts(buildGuestAssignmentDrafts(latest.guests));
      setPaymentAmount(latest.balanceDue > 0 ? String(latest.balanceDue) : "");
      setCashReceived(latest.balanceDue <= 0);
      setStepIndex(2);
    });
  }

  function validateChargeStep(): string | null {
    if (!selected) return "Selecciona una reservación.";
    if (selected.balanceDue <= 0) return null;
    const amount = Number(paymentAmount);
    if (!cashReceived) return 'Confirma que ya recibiste el efectivo marcando "Ya recibí el efectivo".';
    if (!amount || amount <= 0) return "Indica el monto recibido.";
    if (amount > selected.balanceDue) {
      return `El monto no puede exceder ${formatMoney(selected.balanceDue)}.`;
    }
    return null;
  }

  function handleCharge() {
    if (!selected) return;
    const error = validateChargeStep();
    if (error) {
      setStepError(error);
      return;
    }

    setStepError(null);
    startTransition(async () => {
      const latest = (await refreshSelected(selected.reservationId)) ?? selected;
      const amountToCharge =
        latest.balanceDue <= 0 ? 0 : Number(paymentAmount) || latest.balanceDue;

      const fd = new FormData();
      fd.set("folio_id", latest.folioId);
      fd.set("folio_code", latest.folioCode);
      fd.set("method", paymentMethod);
      fd.set("amount", String(amountToCharge));
      fd.set("notes", `Cobro recepción - Folio ${latest.folioCode}`);

      const result = await completeReceptionCheckInAction(fd);
      if (!result.ok) {
        setStepError(result.message);
        return;
      }

      setSuccessState({
        message: result.message,
        whatsappSent: result.whatsappSent,
        balanceDue: result.balanceDue,
        folioId: result.folioId,
        skippedPayment: Boolean(result.skippedPayment),
      });
    });
  }

  function handleResendWhatsApp() {
    if (!successState?.folioId) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("folio_id", successState.folioId);
      fd.set("return_to", "/dashboard");
      await resendPaymentReceiptAction(fd);
    });
  }

  return (
    <Card className="overflow-hidden border-brand-primary/20 p-0 shadow-md">
      {currentStep !== "success" ? (
        <div className="border-b border-border-soft bg-surface-soft/40 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium text-text-main">
              Paso {progressStep} de {STEP_ORDER.length}
            </span>
            <span className="text-text-muted">
              {RECEPTION_STEP_LABELS[STEP_ORDER[stepIndex] ?? "search"]}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border-soft">
            <div
              className="h-full rounded-full bg-brand-primary transition-all"
              style={{ width: `${(progressStep / STEP_ORDER.length) * 100}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        {stepError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {stepError}
          </p>
        ) : null}

        {currentStep === "search" ? (
          <>
            <ReceptionSearchModeToggle mode={searchMode} onChange={handleSearchModeChange} />

            {searchMode === "search" ? (
              <>
                <div>
                  <h2 className="text-lg font-semibold text-text-main">Buscar reservación</h2>
                  <p className="mt-1 text-sm text-text-muted">
                    Nombre, teléfono, correo o número de folio.
                  </p>
                </div>
                <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ej. Juan Pérez, 5512345678, FPB-…"
                    className="h-12 min-w-0 flex-1 rounded-lg border border-border-soft bg-white px-4 text-base text-text-main sm:text-sm"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    className="h-12 w-full shrink-0 px-6 sm:w-auto sm:min-w-[7rem]"
                    disabled={isPending || searchQuery.trim().length < 2}
                  >
                    {isPending ? "Buscando…" : "Buscar"}
                  </Button>
                </form>
                {searchResults.length > 0 ? (
                  <ReceptionReservationList
                    results={searchResults}
                    onSelect={selectReservation}
                    emptyMessage=""
                  />
                ) : null}
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-text-main">Últimas reservaciones</h2>
                    <p className="mt-1 text-sm text-text-muted">
                      Las {recentLimit} más recientes. Toca una para atenderla.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ReceptionRecentLimitFilter
                      value={recentLimit}
                      onChange={handleRecentLimitChange}
                      disabled={isPending}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          await refreshRecentReservations();
                        });
                      }}
                    >
                      {isPending ? "Actualizando…" : "Actualizar"}
                    </Button>
                  </div>
                </div>
                <ReceptionReservationList
                  results={recentReservations}
                  onSelect={selectReservation}
                  showCreatedAt
                  emptyMessage="No hay reservaciones recientes."
                />
              </>
            )}
          </>
        ) : null}

        {currentStep === "assign" && selected ? (
          <>
            <div>
              <h2 className="text-lg font-semibold text-text-main">Asignar cama y locker</h2>
              <p className="text-sm text-text-muted">
                {selected.folioCode} · {selected.guests.map((g) => g.fullName).join(", ")}
              </p>
            </div>

            <div className="rounded-xl border border-border-soft bg-surface-soft/40 p-4">
              <h3 className="text-sm font-semibold text-text-main">Totales de la reservación</h3>
              <dl className="mt-3 space-y-2 text-sm">
                {lockerTotal > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Lockers</dt>
                    <dd className="tabular-nums text-text-main">{formatMoney(lockerTotal)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-text-muted">Total en folio</dt>
                  <dd className="tabular-nums text-text-main">{formatMoney(selected.totalAmount)}</dd>
                </div>
                <p className="pt-1 text-xs text-text-muted">
                  Al continuar se sincroniza el cobro con camas + lockers.
                </p>
              </dl>
            </div>

            <ReceptionGuestAssignmentPanel
              guests={selected.guests}
              drafts={assignmentDrafts}
              onDraftChange={updateAssignmentDraft}
              disabled={isPending}
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={returnToReservationList}
              >
                Buscar otra
              </Button>
              <Button
                type="button"
                variant="primary"
                className="w-full sm:w-auto"
                disabled={isPending}
                onClick={goNextFromAssign}
              >
                {isPending ? "Guardando…" : "Continuar a cobrar"}
              </Button>
            </div>
          </>
        ) : null}

        {currentStep === "charge" && selected ? (
          <>
            <div>
              <h2 className="text-lg font-semibold text-text-main">Cobrar</h2>
              <p className="text-sm text-text-muted">
                {selected.folioCode} · {selected.guests.map((g) => g.fullName).join(", ")}
              </p>
            </div>
            <div className="rounded-xl border border-brand-primary/25 bg-brand-primary/5 p-4 text-center">
              <p className="text-sm text-text-muted">A cobrar</p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-text-main">
                {formatMoney(selected.balanceDue)}
              </p>
              <div className="mt-3 space-y-1 text-sm text-text-muted">
                <p>
                  Camas {formatMoney(bedPortion)}
                  {lockerTotal > 0 ? ` · Lockers ${formatMoney(lockerTotal)}` : ""}
                </p>
                <p>
                  Total {formatMoney(selected.totalAmount)}
                  {selected.paidAmount > 0 ? ` · Pagado ${formatMoney(selected.paidAmount)}` : ""}
                </p>
              </div>
            </div>
            <p className="text-sm text-text-muted">
              {selected.checkInDate} → {selected.checkOutDate} · {selected.nights} noche(s) ·{" "}
              {selected.guests.length} huésped(es)
            </p>
            {lockerTotal > 0 ? (
              <ul className="space-y-1 rounded-xl border border-border-soft bg-surface-soft/30 p-3 text-sm text-text-muted">
                {selected.guests
                  .filter((guest) => guest.lockerAmount > 0)
                  .map((guest) => (
                    <li key={guest.guestId} className="flex justify-between gap-3">
                      <span>
                        Locker {guest.fullName}
                        {guest.lockerNumber ? ` #${guest.lockerNumber}` : ""} · {guest.lockerDays}{" "}
                        día(s)
                      </span>
                      <span className="tabular-nums text-text-main">
                        {formatMoney(guest.lockerAmount)}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : null}
            <div className="space-y-3 rounded-xl border border-border-soft bg-surface-soft/30 p-3">
              <div>
                <h3 className="text-sm font-semibold text-text-main">Nota general de reservación</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-text-muted">
                  {selected.notes ?? "Sin nota general."}
                </p>
              </div>
            </div>
            {selected.balanceDue > 0 ? (
              <>
                <label className="flex items-center gap-2 text-sm text-text-main">
                  <input
                    type="checkbox"
                    checked={cashReceived}
                    onChange={(e) => setCashReceived(e.target.checked)}
                    className="h-4 w-4 rounded border-border-soft"
                  />
                  Ya recibí el efectivo
                </label>
                <label className="flex flex-col gap-1 text-sm text-text-muted">
                  Monto recibido
                  <input
                    type="number"
                    min={0}
                    max={selected.balanceDue}
                    step={0.01}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="h-10 rounded-lg border border-border-soft px-3 text-text-main"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-text-muted">
                  Método de pago
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="h-10 rounded-lg border border-border-soft px-3 text-text-main"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                  </select>
                </label>
              </>
            ) : (
              <p className="rounded-lg bg-surface-soft px-3 py-2 text-sm text-text-muted">
                Esta reservación no tiene saldo pendiente. Confirma para cerrar el check-in.
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={goBack}>
                Atrás
              </Button>
              <Button
                type="button"
                variant="primary"
                className="w-full sm:w-auto sm:min-w-[12rem]"
                disabled={isPending}
                onClick={handleCharge}
              >
                {isPending
                  ? "Registrando…"
                  : selected.balanceDue > 0
                    ? "Registrar pago y enviar WhatsApp"
                    : "Confirmar check-in"}
              </Button>
            </div>
          </>
        ) : null}

        {currentStep === "success" && successState ? (
          <>
            <div className="text-center">
              <p className="text-lg font-semibold text-text-main">Listo</p>
              <p className="mt-2 text-sm text-text-muted">{successState.message}</p>
            </div>
            <ul className="space-y-2 text-sm">
              {!successState.skippedPayment ? (
                <li className="rounded-lg bg-green-50 px-3 py-2 text-green-800">Pago registrado</li>
              ) : null}
              {successState.whatsappSent ? (
                <li className="rounded-lg bg-green-50 px-3 py-2 text-green-800">WhatsApp enviado</li>
              ) : !successState.skippedPayment ? (
                <li className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                  WhatsApp no enviado. Puedes reintentar abajo.
                </li>
              ) : null}
              {successState.balanceDue > 0 ? (
                <li className="rounded-lg bg-surface-soft px-3 py-2 text-text-muted">
                  Saldo pendiente: {formatMoney(successState.balanceDue)}
                </li>
              ) : null}
            </ul>
            {!successState.skippedPayment && !successState.whatsappSent ? (
              <Button type="button" variant="outline" disabled={isPending} onClick={handleResendWhatsApp}>
                Reintentar WhatsApp
              </Button>
            ) : null}
            <Button type="button" variant="primary" className="w-full" onClick={resetWizard}>
              Atender siguiente
            </Button>
          </>
        ) : null}
      </div>
    </Card>
  );
}
