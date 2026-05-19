"use client";

import { useMemo, useState, useEffect } from "react";
import { searchGuestByPhoneAction } from "@/actions/operations";
import { UBICACION_SURFACE_CLASS } from "@/components/landing/constants";
import { DateRangeCalendar } from "@/components/ui/date-range-calendar";

type ReservationFormProps = {
  action: (formData: FormData) => Promise<void>;
  beds: { bed_number: number }[];
  recurringGuest?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    sex?: string | null;
  } | null;
};

type FieldErrors = Partial<Record<"full_name" | "phone" | "email" | "check_in_date" | "check_out_date", string>>;

const LOCKER_DAILY_PRICE = 30;

type GuestFormRow = {
  full_name: string;
  phone: string;
  email: string;
  sex: string;
  add_locker: "no" | "yes";
  locker_days: number;
};

function emptyGuest(): GuestFormRow {
  return { full_name: "", phone: "", email: "", sex: "unknown", add_locker: "no", locker_days: 1 };
}

function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut || checkOut <= checkIn) return 1;
  const from = new Date(`${checkIn}T00:00:00`);
  const to = new Date(`${checkOut}T00:00:00`);
  return Math.max(1, Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
}

export function ReservationForm({ action, beds, recurringGuest }: ReservationFormProps) {
  const [guestCount, setGuestCount] = useState(1);
  const [guests, setGuests] = useState<GuestFormRow[]>([emptyGuest()]);

  const [reservationData, setReservationData] = useState({
    check_in_date: "",
    check_out_date: "",
    notes: ""
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Cuando cambie el número de huéspedes, ajustamos el arreglo
  useEffect(() => {
    setGuests(prev => {
      const newGuests = [...prev];
      if (guestCount > prev.length) {
        for (let i = prev.length; i < guestCount; i++) {
          newGuests.push(emptyGuest());
        }
      } else if (guestCount < prev.length) {
        newGuests.splice(guestCount);
      }
      return newGuests;
    });
  }, [guestCount]);

  const [searchPhone, setSearchPhone] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (recurringGuest) {
      setGuests((prev) => {
        const newGuests = [...prev];
        newGuests[0] = {
          ...newGuests[0],
          full_name: recurringGuest.full_name || newGuests[0].full_name,
          phone: recurringGuest.phone || newGuests[0].phone,
          email: recurringGuest.email || newGuests[0].email,
        };
        return newGuests;
      });
    }
  }, [recurringGuest]);

  const handleSearch = async () => {
    setSearchError("");
    if (!searchPhone) return;
    setIsSearching(true);
    try {
      const res = await searchGuestByPhoneAction(searchPhone);
      if (res.success && res.guest) {
        setGuests((prev) => {
          const newGuests = [...prev];
          newGuests[0] = {
            ...newGuests[0],
            full_name: res.guest.full_name || newGuests[0].full_name,
            phone: res.guest.phone || newGuests[0].phone,
            email: res.guest.email || newGuests[0].email,
            sex: res.guest.sex || newGuests[0].sex,
          };
          return newGuests;
        });

      } else {
        setSearchError("No se encontró el número.");
      }
    } catch (e) {
      setSearchError("Error al buscar.");
    } finally {
      setIsSearching(false);
    }
  };

  const stayNights = useMemo(
    () => nightsBetween(reservationData.check_in_date, reservationData.check_out_date),
    [reservationData.check_in_date, reservationData.check_out_date],
  );

  useEffect(() => {
    setGuests((prev) =>
      prev.map((guest) => {
        if (guest.add_locker !== "yes") return guest;
        const locker_days = Math.min(Math.max(1, guest.locker_days), stayNights);
        return { ...guest, locker_days };
      }),
    );
  }, [stayNights]);

  const errors = useMemo<FieldErrors>(() => {
    const next: FieldErrors = {};
    if (!reservationData.check_in_date) next.check_in_date = "Selecciona fecha de entrada.";
    if (!reservationData.check_out_date) next.check_out_date = "Selecciona fecha de salida.";
    if (reservationData.check_in_date && reservationData.check_out_date && reservationData.check_out_date <= reservationData.check_in_date) {
      next.check_out_date = "La salida debe ser posterior al check-in.";
    }
    return next;
  }, [reservationData]);

  const updateGuest = (index: number, field: keyof GuestFormRow, value: string | number) => {
    setGuests((prev) => {
      const newGuests = [...prev];
      const current = { ...newGuests[index] };
      if (field === "add_locker") {
        const addLocker = value === "yes" ? "yes" : "no";
        current.add_locker = addLocker;
        if (addLocker === "yes") {
          current.locker_days = stayNights;
        }
      } else if (field === "locker_days") {
        const days = Number(value);
        current.locker_days = Math.min(Math.max(1, Number.isFinite(days) ? days : 1), stayNights);
      } else {
        (current as Record<string, string | number>)[field] = value;
      }
      newGuests[index] = current;
      return newGuests;
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setSubmitResult(null);

    // Verificar si hay errores antes de enviar
    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) return;

    const hasEmptyGuests = guests.some(g => !g.full_name.trim() || !g.phone.trim());
    if (hasEmptyGuests) {
      setSubmitResult({ success: false, message: "Todos los huéspedes deben tener nombre y teléfono." });
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("guests_data", JSON.stringify(guests));
      formData.set("check_in_date", reservationData.check_in_date);
      formData.set("check_out_date", reservationData.check_out_date);
      formData.set("notes", reservationData.notes);
      formData.set("reservation_source", "guest_app");
      formData.set("return_to", "/");

      await action(formData);
    } catch (err: unknown) {
      // Next.js redirect() lanza un error especial que debemos relanzar
      if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
      if (typeof err === "object" && err !== null && "digest" in err && (err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw err;
      setSubmitResult({ success: false, message: "Ocurrió un error al registrar la reservación." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showError = (name: keyof FieldErrors) => (submitAttempted || touched[name]) && Boolean(errors[name]);

  return (
    <div className="flex flex-col gap-4">
      {/* Buscador de Cliente Recurrente (Client-side, sin recargar página) */}
      <div
        className={`rounded-2xl border border-white/15 p-4 shadow-md shadow-mkt-slate-deep/20 ${UBICACION_SURFACE_CLASS}`}
      >
        <p className="text-sm font-semibold text-mkt-terracotta">Cliente recurrente</p>
        <p className="mt-1 text-xs text-white/75">Ingresa teléfono para autocompletar y aplicar descuento.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-mkt-border bg-white px-3 text-sm text-mkt-ink outline-none focus:border-mkt-terracotta"
            placeholder="Teléfono (ej. 7712...)"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            className="rounded-full bg-mkt-terracotta px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-mkt-terracotta-hover disabled:opacity-50"
          >
            {isSearching ? "Buscando..." : "Buscar"}
          </button>
        </div>
        {searchError && <p className="mt-2 text-xs text-red-300">{searchError}</p>}
      </div>

      <form
        className={`rounded-3xl border border-white/15 p-4 shadow-md shadow-mkt-slate-deep/20 sm:p-6 ${UBICACION_SURFACE_CLASS}`}
        onSubmit={handleSubmit}
        noValidate
      >
        {/* Rango de Fechas y Personas (Nivel Reservación) */}
        <div className="mb-6 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-mkt-terracotta">
            Rango de fechas
          </label>
          <DateRangeCalendar
            checkInDate={reservationData.check_in_date}
            checkOutDate={reservationData.check_out_date}
            onChange={(checkIn, checkOut) => {
              setReservationData((prev) => ({ ...prev, check_in_date: checkIn, check_out_date: checkOut }));
              setTouched((prev) => ({ ...prev, check_in_date: true, check_out_date: true }));
            }}
          />
          {(showError("check_in_date") || showError("check_out_date")) && (
            <p className="mt-1 text-xs text-red-300">{errors.check_in_date || errors.check_out_date}</p>
          )}
          <div className="max-w-[140px]">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-mkt-terracotta">
              Personas
            </label>
            <input
              type="number"
              min="1"
              max="20"
              className="w-full rounded-xl border border-mkt-border bg-white px-3 py-2 text-sm text-mkt-ink"
              value={guestCount}
              onChange={(e) => setGuestCount(Number(e.target.value) || 1)}
            />
          </div>
        </div>

        {/* Tarjetas de Huéspedes Dinámicas */}
        <div className="space-y-4">
          <p className="text-xs text-white/70">* Nota: El Husped 1 sera el Huesped Principal</p>
          {guests.map((guest, index) => (
            <div key={index} className="rounded-xl border border-mkt-border bg-white p-4">
              <h4 className="mb-3 text-sm font-semibold text-mkt-ink">Huésped {index + 1}</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-mkt-border px-3 py-2 text-sm text-mkt-ink"
                  placeholder="Nombre completo"
                  value={guest.full_name}
                  required
                  onChange={(e) => updateGuest(index, "full_name", e.target.value)}
                />
                <input
                  type="tel"
                  className="w-full rounded-xl border border-mkt-border px-3 py-2 text-sm text-mkt-ink"
                  placeholder="Teléfono"
                  value={guest.phone}
                  required
                  onChange={(e) => updateGuest(index, "phone", e.target.value)}
                />
                <input
                  type="email"
                  className="w-full rounded-xl border border-mkt-border px-3 py-2 text-sm text-mkt-ink"
                  placeholder="Correo electrónico"
                  value={guest.email}
                  required
                  onChange={(e) => updateGuest(index, "email", e.target.value)}
                />
                <select
                  className="rounded-xl border border-mkt-border bg-white px-3 py-2 text-sm text-mkt-ink"
                  value={guest.sex}
                  onChange={(e) => updateGuest(index, "sex", e.target.value)}
                >
                  <option value="unknown">Sexo</option>
                  <option value="f">Femenino</option>
                  <option value="m">Masculino</option>
                  <option value="x">Otro</option>
                </select>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-mkt-terracotta">
                    Añadir locker
                  </label>
                  <select
                    className="w-full rounded-xl border border-mkt-border bg-white px-3 py-2 text-sm text-mkt-ink"
                    value={guest.add_locker}
                    onChange={(e) => updateGuest(index, "add_locker", e.target.value)}
                  >
                    <option value="no">No</option>
                    <option value="yes">Sí (+${LOCKER_DAILY_PRICE}/día)</option>
                  </select>
                </div>
                {guest.add_locker === "yes" && (
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-mkt-terracotta">
                      Días de locker a pagar
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={stayNights}
                      className="w-full max-w-[140px] rounded-xl border border-mkt-border px-3 py-2 text-sm text-mkt-ink"
                      value={guest.locker_days}
                      onChange={(e) => updateGuest(index, "locker_days", e.target.value)}
                    />
                    <p className="mt-1 text-xs text-mkt-ink/70">
                      Máximo {stayNights} noche{stayNights === 1 ? "" : "s"} de estancia. Cargo: $
                      {(guest.locker_days * LOCKER_DAILY_PRICE).toFixed(0)} MXN (
                      {guest.locker_days} × ${LOCKER_DAILY_PRICE}).
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Notas Generales */}
        <textarea
          name="notes"
          className="mt-6 min-h-20 w-full rounded-xl border border-mkt-border bg-white px-3 py-2 text-sm text-mkt-ink"
          placeholder="Notas de la reservación (opcional)"
          value={reservationData.notes}
          onChange={(e) => setReservationData(prev => ({ ...prev, notes: e.target.value }))}
        />
        <p className="mt-3 text-xs text-white/70">Las camas serán asignadas automáticamente al registrar tu reservación.</p>

        {submitResult && (
          <div className={`mt-3 rounded-lg p-3 text-sm ${submitResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {submitResult.message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-mkt-terracotta px-4 font-semibold text-white shadow-sm transition hover:bg-mkt-terracotta-hover disabled:opacity-50"
        >
          {isSubmitting ? "Registrando..." : "Registrar reservación"}
        </button>
      </form>

    </div >
  );
}
