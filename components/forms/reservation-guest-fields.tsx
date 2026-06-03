"use client";

import { LOCKER_DAILY_PRICE, type GuestFormRow } from "@/hooks/use-reservation-form";

type ReservationGuestFieldsProps = {
  guest: GuestFormRow;
  guestIndex: number;
  stayNights: number;
  isPrincipal?: boolean;
  variant?: "marketing" | "dashboard";
  onChange: (field: keyof GuestFormRow, value: string | number) => void;
};

export function ReservationGuestFields({
  guest,
  guestIndex,
  stayNights,
  isPrincipal = guestIndex === 0,
  variant = "marketing",
  onChange,
}: ReservationGuestFieldsProps) {
  const isDashboard = variant === "dashboard";
  const inputClass = isDashboard
    ? "w-full rounded-lg border border-border-soft bg-white px-3 py-2 text-sm text-text-main"
    : "w-full rounded-xl border border-mkt-border bg-white px-3 py-2.5 text-sm text-mkt-ink";
  const labelClass = isDashboard
    ? "mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted"
    : "mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-mkt-terracotta";
  const hintClass = isDashboard ? "mt-1 text-xs text-text-muted" : "mt-1 text-xs text-white/70";

  return (
    <div className="space-y-3">
      {isPrincipal ? (
        <p className={hintClass}>El huésped 1 es el huésped principal.</p>
      ) : null}
      <input
        className={inputClass}
        placeholder="Nombre completo *"
        value={guest.full_name}
        required
        autoComplete={isPrincipal ? "name" : "off"}
        onChange={(e) => onChange("full_name", e.target.value)}
      />
      <input
        type="tel"
        className={inputClass}
        placeholder="Teléfono *"
        value={guest.phone}
        required
        autoComplete={isPrincipal ? "tel" : "off"}
        onChange={(e) => onChange("phone", e.target.value)}
      />
      <input
        type="email"
        className={inputClass}
        placeholder="Correo electrónico *"
        value={guest.email}
        required
        autoComplete={isPrincipal ? "email" : "off"}
        onChange={(e) => onChange("email", e.target.value)}
      />
      <select
        className={inputClass}
        value={guest.sex}
        required
        onChange={(e) => onChange("sex", e.target.value)}
      >
        <option value="unknown">Sexo *</option>
        <option value="f">Femenino</option>
        <option value="m">Masculino</option>
        <option value="x">Otro</option>
      </select>
      <div>
        <label className={labelClass}>Añadir locker</label>
        <select
          className={inputClass}
          value={guest.add_locker}
          onChange={(e) => onChange("add_locker", e.target.value)}
        >
          <option value="no">No</option>
          <option value="yes">Sí (+${LOCKER_DAILY_PRICE}/día)</option>
        </select>
      </div>
      {guest.add_locker === "yes" ? (
        <>
          <div>
            <label className={labelClass}>Días de locker</label>
            <input
              type="number"
              min={1}
              max={stayNights}
              className={`${inputClass} max-w-[140px]`}
              value={guest.locker_days}
              onChange={(e) => onChange("locker_days", e.target.value)}
            />
            <p className={hintClass}>
              Máx. {stayNights} noche{stayNights === 1 ? "" : "s"}. Cargo: $
              {(guest.locker_days * LOCKER_DAILY_PRICE).toFixed(0)} MXN
            </p>
          </div>
          <div>
            <label className={labelClass}>Número de locker (opcional)</label>
            <input
              type="number"
              min={1}
              className={`${inputClass} max-w-[140px]`}
              placeholder="Ej. 12"
              value={guest.locker_number}
              onChange={(e) => onChange("locker_number", e.target.value)}
            />
            <p className={hintClass}>
              Déjalo vacío si aún no asignas el locker; aparecerá como pendiente en reservas.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
