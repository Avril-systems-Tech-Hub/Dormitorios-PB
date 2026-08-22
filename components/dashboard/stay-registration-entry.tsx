"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getBedsForStayRangeAction,
  registerStaffStayAction,
  searchGuestByPhoneAction,
} from "@/actions/operations";
import { BedZonePicker, type BedMapItem } from "@/components/dashboard/bed-zone-picker";
import { ReservationGuestFields } from "@/components/forms/reservation-guest-fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  emptyGuest,
  LOCKER_DAILY_PRICE,
  type GuestFormRow,
  validateGuestRow,
} from "@/hooks/use-reservation-form";
import { getMexicoCityDateString } from "@/lib/dates";
import {
  daysBetween,
  STAY_REGISTRATION_MODES,
  type StayRegistrationMode,
  validateStayDates,
} from "@/lib/stay-registration";

const NIGHTLY_RATE = 120;

type StayGuestDraft = GuestFormRow & { bed_id: string };

function emptyStayGuest(): StayGuestDraft {
  return { ...emptyGuest(), bed_id: "" };
}

export function StayRegistrationEntry({ role }: { role: string }) {
  const router = useRouter();
  const today = getMexicoCityDateString();
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayString = yesterday.toISOString().slice(0, 10);
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowString = tomorrow.toISOString().slice(0, 10);
  const [mode, setMode] = useState<StayRegistrationMode>("new");
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState<StayGuestDraft[]>([emptyStayGuest()]);
  const [folioCode, setFolioCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [assignBedsNow, setAssignBedsNow] = useState(false);
  const [beds, setBeds] = useState<BedMapItem[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isPending, startTransition] = useTransition();

  const nights = Math.max(1, daysBetween(checkIn, checkOut));
  const lockerTotal = guests.reduce(
    (sum, guest) =>
      sum +
      (guest.add_locker === "yes"
        ? Math.min(nights, guest.locker_days) * LOCKER_DAILY_PRICE
        : 0),
    0,
  );
  const discount = mode === "new" ? Math.min(100, Math.max(0, Number(discountPercent) || 0)) : 0;
  const nightsTotal =
    Math.round((guests.length * nights * NIGHTLY_RATE * (100 - discount) / 100) * 100) / 100;
  const totalAmount = Math.round((nightsTotal + lockerTotal) * 100) / 100;
  const requiresBeds = mode === "current" || (mode === "new" && assignBedsNow);
  const dateError = validateStayDates(mode, checkIn, checkOut, today);
  const modeLabel =
    mode === "new"
      ? "Nueva estancia"
      : mode === "current"
        ? "Estancia en curso"
        : "Estancia terminada";

  useEffect(() => {
    if (!requiresBeds || dateError) {
      return;
    }
    let cancelled = false;
    getBedsForStayRangeAction(checkIn, checkOut)
      .then((result) => {
        if (!cancelled) setBeds(result);
      })
      .catch(() => {
        if (!cancelled) toast.error("No se pudo consultar la disponibilidad de camas.");
      });
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, dateError, requiresBeds]);

  const selectedBedIds = useMemo(
    () => new Set(guests.map((guest) => guest.bed_id).filter(Boolean)),
    [guests],
  );

  function updateGuest(index: number, field: keyof StayGuestDraft, value: string | number) {
    setGuests((current) =>
      current.map((guest, guestIndex) => {
        if (guestIndex !== index) return guest;
        const next = { ...guest };
        if (field === "add_locker") {
          next.add_locker = value === "yes" ? "yes" : "no";
          next.locker_days = next.add_locker === "yes" ? nights : 0;
          if (next.add_locker === "no") next.locker_number = "";
        } else if (field === "locker_days") {
          next.locker_days = Math.min(nights, Math.max(1, Number(value) || 1));
        } else {
          (next as unknown as Record<string, string | number | null>)[field] = value;
          if (field === "phone") {
            next.existing_guest_id = "";
            next.match_decision = "";
            next.matched_guest = null;
            next.phone_lookup_status = "idle";
          }
        }
        return next;
      }),
    );
  }

  async function lookupGuest(index: number) {
    const phone = guests[index]?.phone ?? "";
    setGuests((current) =>
      current.map((guest, guestIndex) =>
        guestIndex === index ? { ...guest, phone_lookup_status: "searching" } : guest,
      ),
    );
    try {
      const result = await searchGuestByPhoneAction(phone);
      setGuests((current) =>
        current.map((guest, guestIndex) => {
          if (guestIndex !== index) return guest;
          if (result.success && result.guest) {
            return {
              ...guest,
              matched_guest: result.guest,
              existing_guest_id: "",
              match_decision: "",
              phone_lookup_status: "matched",
            };
          }
          return {
            ...guest,
            matched_guest: null,
            existing_guest_id: "",
            match_decision: "create_new",
            phone_lookup_status: "none",
          };
        }),
      );
    } catch {
      setGuests((current) =>
        current.map((guest, guestIndex) =>
          guestIndex === index ? { ...guest, phone_lookup_status: "error" } : guest,
        ),
      );
    }
  }

  function decideGuestMatch(index: number, decision: "reuse" | "create_new") {
    setGuests((current) =>
      current.map((guest, guestIndex) => {
        if (guestIndex !== index || !guest.matched_guest) return guest;
        if (decision === "create_new") {
          return { ...guest, existing_guest_id: "", match_decision: decision };
        }
        return {
          ...guest,
          full_name: guest.matched_guest.full_name,
          phone: guest.matched_guest.phone ?? guest.phone,
          email: guest.matched_guest.email ?? "",
          sex: guest.matched_guest.sex ?? "unknown",
          existing_guest_id: guest.matched_guest.id,
          match_decision: decision,
        };
      }),
    );
  }

  function resetForm(nextMode: StayRegistrationMode = mode) {
    setMode(nextMode);
    setCheckIn(nextMode === "new" ? today : "");
    setCheckOut("");
    setGuests([emptyStayGuest()]);
    setFolioCode("");
    setDiscountPercent("0");
    setPaymentAmount("0");
    setPaymentMethod("cash");
    setPaymentDate(today);
    setPaymentNotes("");
    setNotes("");
    setAssignBedsNow(false);
    setBeds([]);
  }

  function submit() {
    const firstGuestError = guests
      .map((guest) => validateGuestRow(guest, false))
      .find(Boolean);
    const payment = Number(paymentAmount) || 0;

    if (dateError) return toast.error(dateError);
    if (firstGuestError) return toast.error(firstGuestError);
    if (requiresBeds && guests.some((guest) => !guest.bed_id)) {
      return toast.error("Asigna una cama para cada huésped.");
    }
    if (mode === "new" && payment > 0 && !assignBedsNow) {
      return toast.error("Asigna todas las camas antes de registrar un cobro.");
    }
    if (selectedBedIds.size !== guests.filter((guest) => guest.bed_id).length) {
      return toast.error("No puedes asignar la misma cama a dos huéspedes.");
    }
    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      return toast.error("El total de la estancia no es válido.");
    }
    if (payment < 0 || payment > totalAmount) {
      return toast.error("El pago debe estar entre cero y el total.");
    }
    if (payment > 0 && (!paymentDate || paymentDate > today)) {
      return toast.error("Indica la fecha real del pago; no puede ser futura.");
    }
    if (
      mode === "current" &&
      guests.some(
        (guest) => guest.add_locker === "yes" && !guest.locker_number.trim(),
      )
    ) {
      return toast.error("Las estancias en curso requieren el código de cada locker utilizado.");
    }
    setShowConfirmation(true);
  }

  function confirmRegistration() {
    const payment = Number(paymentAmount) || 0;
    const submissionId = crypto.randomUUID();
    const formData = new FormData();
    formData.set("submission_id", submissionId);
    formData.set("mode", mode);
    formData.set("check_in_date", checkIn);
    formData.set("check_out_date", checkOut);
    formData.set("folio_code", folioCode);
    formData.set("total_amount", String(totalAmount));
    formData.set("discount_percent", String(discount));
    formData.set("payment_amount", String(payment));
    formData.set("payment_method", paymentMethod);
    formData.set("payment_date", payment > 0 ? paymentDate : "");
    formData.set("payment_notes", paymentNotes);
    formData.set("notes", notes);
    formData.set(
      "guests_data",
      JSON.stringify(
        guests.map((guest) => ({
          full_name: guest.full_name,
          phone: guest.phone,
          email: guest.email,
          sex: guest.sex,
          existing_guest_id:
            guest.match_decision === "reuse" ? guest.existing_guest_id || null : null,
          match_decision:
            guest.match_decision === "reuse"
              ? "reuse"
              : guest.phone.trim()
                ? "create_new"
                : null,
          bed_id: requiresBeds ? guest.bed_id : null,
          locker_days: guest.add_locker === "yes" ? guest.locker_days : 0,
          locker_number:
            guest.add_locker === "yes" ? guest.locker_number.trim() || null : null,
        })),
      ),
    );

    startTransition(async () => {
      const result = await registerStaffStayAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setShowConfirmation(false);
      toast.success(result.message);
      if (mode === "new" && !requiresBeds && result.reservationId) {
        router.push(
          role === "reception"
            ? `/dashboard?checkin_reservation=${result.reservationId}`
            : "/dashboard/reservations",
        );
        return;
      }
      resetForm(mode);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-xl font-semibold text-text-main">Registrar estancia</h1>
        <p className="mt-1 text-sm text-text-muted">
          Elige el tipo correcto para mantener camas, pagos e historial relacionados.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {STAY_REGISTRATION_MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => resetForm(option.value)}
              className={`rounded-xl border p-4 text-left transition ${
                mode === option.value
                  ? "border-brand-primary bg-brand-primary/5 ring-2 ring-brand-primary/15"
                  : "border-border-soft bg-white hover:border-brand-primary/40"
              }`}
            >
              <span className="font-semibold text-text-main">{option.label}</span>
              <span className="mt-1 block text-sm text-text-muted">{option.description}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-sm text-text-main">
            Entrada
            <input
              type="date"
              value={checkIn}
              min={mode === "new" ? today : undefined}
              max={mode === "current" ? yesterdayString : mode === "finished" ? today : undefined}
              onChange={(event) => setCheckIn(event.target.value)}
              className="h-10 rounded-lg border border-border-soft bg-white px-3"
            />
          </label>
          <label className="grid gap-1 text-sm text-text-main">
            Salida
            <input
              type="date"
              value={checkOut}
              max={mode === "finished" ? today : undefined}
              min={mode === "current" ? tomorrowString : checkIn || undefined}
              onChange={(event) => setCheckOut(event.target.value)}
              className="h-10 rounded-lg border border-border-soft bg-white px-3"
            />
          </label>
        </div>
        <p className={`mt-2 text-sm ${dateError ? "text-red-700" : "text-text-muted"}`}>
          {dateError ?? `${nights} noche(s) de estancia.`}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-text-main">Huéspedes</h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-xs"
              disabled={guests.length <= 1}
              onClick={() => setGuests((current) => current.slice(0, -1))}
            >
              Quitar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => setGuests((current) => [...current, emptyStayGuest()])}
            >
              Añadir persona
            </Button>
          </div>
        </div>

        <div className="mt-3 space-y-4">
          {guests.map((guest, index) => (
            <section
              key={index}
              className="dashboard-brand-panel rounded-xl p-4 sm:p-5"
            >
              <h3 className="mb-3 text-sm font-semibold text-white">Huésped {index + 1}</h3>
              <ReservationGuestFields
                guest={guest}
                guestIndex={index}
                stayNights={nights}
                variant="dashboard"
                contactRequired={false}
                enablePhoneMatching
                showLockerFields
                showLockerNumberField={mode !== "finished"}
                onLookupPhone={() => void lookupGuest(index)}
                onMatchDecision={(decision) => decideGuestMatch(index, decision)}
                onChange={(field, value) => updateGuest(index, field, value)}
              />
            </section>
          ))}
        </div>

        {mode === "new" ? (
          <label className="mt-4 flex items-start gap-2 rounded-lg border border-border-soft p-3 text-sm">
            <input
              type="checkbox"
              checked={assignBedsNow}
              onChange={(event) => setAssignBedsNow(event.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <strong className="block text-text-main">Asignar camas ahora</strong>
              <span className="text-text-muted">
                Si no, la reservación se abrirá en el check-in para asignarlas después.
              </span>
            </span>
          </label>
        ) : null}

        {requiresBeds ? (
          <div className="mt-5 space-y-4">
            <h2 className="font-semibold text-text-main">Asignación de camas</h2>
            {beds.length === 0 ? (
              <p className="text-sm text-text-muted">Consultando disponibilidad…</p>
            ) : null}
            {beds.length > 0
              ? guests.map((guest, index) => {
                  const bedsForGuest = beds.map((bed) =>
                    selectedBedIds.has(bed.id) && bed.id !== guest.bed_id
                      ? { ...bed, occupied_by: "Seleccionada para otra persona" }
                      : bed,
                  );
                  return (
                    <section key={`bed-${index}`} className="rounded-xl border border-border-soft p-4">
                      <p className="mb-3 text-sm font-semibold text-text-main">
                        {guest.full_name || `Huésped ${index + 1}`}
                      </p>
                      <BedZonePicker
                        beds={bedsForGuest}
                        selectedBedId={guest.bed_id || null}
                        compact
                        onSelect={(bedId) => updateGuest(index, "bed_id", bedId)}
                      />
                    </section>
                  );
                })
              : null}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {mode !== "new" ? (
            <label className="grid gap-1 text-sm text-text-main">
              Folio original (opcional)
              <input
                value={folioCode}
                onChange={(event) => setFolioCode(event.target.value.toUpperCase())}
                placeholder="Si no tienes, se asigna IMP-…"
                className="h-10 rounded-lg border border-border-soft bg-white px-3"
              />
              <span className="text-xs text-text-muted">
                Déjalo vacío y el sistema asigna un folio IMP- automáticamente.
              </span>
            </label>
          ) : (
            <label className="grid gap-1 text-sm text-text-main">
              Descuento
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={discountPercent}
                  onChange={(event) => setDiscountPercent(event.target.value)}
                  className="h-10 w-28 rounded-lg border border-border-soft bg-white px-3"
                />
                %
              </span>
            </label>
          )}
          <div className="rounded-lg border border-border-soft bg-surface-soft p-3 text-sm">
            <span className="text-text-muted">Total calculado</span>
            <strong className="mt-1 block text-lg text-text-main">
              ${totalAmount.toFixed(2)} MXN
            </strong>
            <span className="mt-1 block text-xs text-text-muted">
              Noches ${nightsTotal.toFixed(2)}
              {lockerTotal > 0 ? ` + lockers $${lockerTotal.toFixed(2)}` : ""}
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border-soft bg-surface-soft/40 p-4">
          <h2 className="font-semibold text-text-main">
            {mode === "new" ? "Pago recibido ahora (opcional)" : "Pago ya recibido (opcional)"}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {mode === "new"
              ? "Si cobras ahora, debes asignar todas las camas y el pago se relaciona con el turno abierto."
              : "Se guardará con su fecha real y nunca se añadirá al turno actual."}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm">
              Monto
              <input
                type="number"
                min="0"
                max={totalAmount}
                step="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                className="h-10 rounded-lg border border-border-soft bg-white px-3"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Método
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className="h-10 rounded-lg border border-border-soft bg-white px-3"
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Fecha real del pago
              <input
                type="date"
                value={paymentDate}
                max={today}
                disabled={mode === "new"}
                onChange={(event) => setPaymentDate(event.target.value)}
                className="h-10 rounded-lg border border-border-soft bg-white px-3 disabled:bg-surface-soft"
              />
            </label>
          </div>
          <textarea
            value={paymentNotes}
            onChange={(event) => setPaymentNotes(event.target.value)}
            placeholder="Notas del pago (opcional)"
            className="mt-3 min-h-20 w-full rounded-lg border border-border-soft bg-white px-3 py-2 text-sm"
          />
        </div>

        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notas de la estancia (opcional)"
          className="mt-4 min-h-20 w-full rounded-lg border border-border-soft bg-white px-3 py-2 text-sm"
        />

        <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          {mode === "finished"
            ? "Esta estancia se guardará terminada, sin cama y sin bloquear inventario."
            : mode === "current"
              ? "Esta estancia quedará activa y bloqueará las camas durante todo el periodo."
              : assignBedsNow
                ? "La reservación se creará con camas asignadas."
                : "La reservación se creará sin cama y continuará en el check-in."}
        </div>

        <Button
          type="button"
          className="mt-5 w-full"
          disabled={isPending}
          onClick={submit}
        >
          {isPending ? "Registrando…" : "Registrar estancia"}
        </Button>
      </Card>

      {showConfirmation ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isPending) {
              setShowConfirmation(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="stay-confirmation-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border-soft bg-white shadow-2xl"
          >
            <header className="sticky top-0 z-10 border-b border-border-soft bg-white px-5 py-4 sm:px-6">
              <h2 id="stay-confirmation-title" className="text-lg font-semibold text-text-main">
                Confirma los datos antes de registrar
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Nada se guardará en la base de datos hasta que confirmes.
              </p>
            </header>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-3 rounded-xl border border-border-soft bg-surface-soft/50 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-text-muted">Tipo de registro</p>
                  <p className="mt-1 text-sm font-semibold text-text-main">{modeLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Entrada</p>
                  <p className="mt-1 text-sm font-semibold text-text-main">{checkIn}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Salida</p>
                  <p className="mt-1 text-sm font-semibold text-text-main">{checkOut}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Duración</p>
                  <p className="mt-1 text-sm font-semibold text-text-main">{nights} noche(s)</p>
                </div>
                {mode !== "new" ? (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-text-muted">Folio</p>
                    <p className="mt-1 text-sm font-semibold text-text-main">
                      {folioCode.trim() || "Se asignará IMP- automáticamente"}
                    </p>
                  </div>
                ) : null}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-text-main">
                  {guests.length === 1 ? "Huésped" : `Huéspedes (${guests.length})`}
                </h3>
                <div className="space-y-2">
                  {guests.map((guest, index) => {
                    const assignedBed = beds.find((bed) => bed.id === guest.bed_id);
                    return (
                      <div
                        key={`${guest.full_name}-${index}`}
                        className="rounded-xl border border-border-soft p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-text-main">{guest.full_name}</p>
                            <p className="mt-0.5 text-xs text-text-muted">
                              {guest.existing_guest_id
                                ? "Huésped existente"
                                : "Nuevo huésped"}
                            </p>
                          </div>
                          {requiresBeds ? (
                            <span className="rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-primary">
                              Cama {assignedBed?.bed_number ?? guest.bed_id}
                            </span>
                          ) : (
                            <span className="rounded-full bg-surface-soft px-2.5 py-1 text-xs font-medium text-text-muted">
                              Sin cama
                            </span>
                          )}
                        </div>
                        <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-xs text-text-muted">Teléfono</dt>
                            <dd className="text-text-main">{guest.phone || "No registrado"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-text-muted">Correo</dt>
                            <dd className="break-all text-text-main">
                              {guest.email || "No registrado"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-text-muted">Sexo</dt>
                            <dd className="text-text-main">
                              {guest.sex === "male"
                                ? "Hombre"
                                : guest.sex === "female"
                                  ? "Mujer"
                                  : "No especificado"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-text-muted">Locker</dt>
                            <dd className="text-text-main">
                              {guest.add_locker === "yes"
                                ? `${guest.locker_number || "Sin código"} · ${guest.locker_days} día(s)`
                                : "Sin locker"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border border-border-soft p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-text-muted">Total de la estancia</p>
                  <p className="mt-1 text-lg font-semibold text-text-main">
                    ${totalAmount.toFixed(2)} MXN
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Pago registrado</p>
                  <p className="mt-1 text-lg font-semibold text-text-main">
                    ${(Number(paymentAmount) || 0).toFixed(2)} MXN
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Método y fecha</p>
                  <p className="mt-1 text-sm font-semibold text-text-main">
                    {Number(paymentAmount) > 0
                      ? `${
                          paymentMethod === "cash"
                            ? "Efectivo"
                            : paymentMethod === "transfer"
                              ? "Transferencia"
                              : "Tarjeta"
                        } · ${paymentDate}`
                      : "Sin pago"}
                  </p>
                </div>
              </div>

              {notes.trim() || paymentNotes.trim() ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {notes.trim() ? (
                    <div className="rounded-xl border border-border-soft p-4">
                      <p className="text-xs text-text-muted">Notas de estancia</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-text-main">{notes}</p>
                    </div>
                  ) : null}
                  {paymentNotes.trim() ? (
                    <div className="rounded-xl border border-border-soft p-4">
                      <p className="text-xs text-text-muted">Notas de pago</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-text-main">
                        {paymentNotes}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border-soft bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setShowConfirmation(false)}
              >
                Volver a editar
              </Button>
              <Button type="button" disabled={isPending} onClick={confirmRegistration}>
                {isPending ? "Registrando…" : "Confirmar registro"}
              </Button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

