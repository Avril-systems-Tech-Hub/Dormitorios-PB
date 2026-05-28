"use client";

import { LOCKER_DAILY_PRICE, type GuestFormRow } from "@/hooks/use-reservation-form";

type ReservationGuestFieldsProps = {
  guest: GuestFormRow;
  guestIndex: number;
  stayNights: number;
  isPrincipal?: boolean;
  onChange: (field: keyof GuestFormRow, value: string | number) => void;
};

export function ReservationGuestFields({
  guest,
  guestIndex,
  stayNights,
  isPrincipal = guestIndex === 0,
  onChange,
}: ReservationGuestFieldsProps) {
  return (
    <div className="space-y-3">
      {isPrincipal ? (
        <p className="text-xs text-white/70">El huésped 1 es el huésped principal.</p>
      ) : null}
      <input
        className="w-full rounded-xl border border-mkt-border bg-white px-3 py-2.5 text-sm text-mkt-ink"
        placeholder="Nombre completo *"
        value={guest.full_name}
        required
        autoComplete={isPrincipal ? "name" : "off"}
        onChange={(e) => onChange("full_name", e.target.value)}
      />
      <input
        type="tel"
        className="w-full rounded-xl border border-mkt-border bg-white px-3 py-2.5 text-sm text-mkt-ink"
        placeholder="Teléfono *"
        value={guest.phone}
        required
        autoComplete={isPrincipal ? "tel" : "off"}
        onChange={(e) => onChange("phone", e.target.value)}
      />
      <input
        type="email"
        className="w-full rounded-xl border border-mkt-border bg-white px-3 py-2.5 text-sm text-mkt-ink"
        placeholder="Correo electrónico *"
        value={guest.email}
        required
        autoComplete={isPrincipal ? "email" : "off"}
        onChange={(e) => onChange("email", e.target.value)}
      />
      <select
        className="w-full rounded-xl border border-mkt-border bg-white px-3 py-2.5 text-sm text-mkt-ink"
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
        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-mkt-terracotta">
          Añadir locker
        </label>
        <select
          className="w-full rounded-xl border border-mkt-border bg-white px-3 py-2.5 text-sm text-mkt-ink"
          value={guest.add_locker}
          onChange={(e) => onChange("add_locker", e.target.value)}
        >
          <option value="no">No</option>
          <option value="yes">Sí (+${LOCKER_DAILY_PRICE}/día)</option>
        </select>
      </div>
      {guest.add_locker === "yes" ? (
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-mkt-terracotta">
            Días de locker
          </label>
          <input
            type="number"
            min={1}
            max={stayNights}
            className="w-full max-w-[140px] rounded-xl border border-mkt-border bg-white px-3 py-2.5 text-sm text-mkt-ink"
            value={guest.locker_days}
            onChange={(e) => onChange("locker_days", e.target.value)}
          />
          <p className="mt-1 text-xs text-white/70">
            Máx. {stayNights} noche{stayNights === 1 ? "" : "s"}. Cargo: $
            {(guest.locker_days * LOCKER_DAILY_PRICE).toFixed(0)} MXN
          </p>
        </div>
      ) : null}
    </div>
  );
}
