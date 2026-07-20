"use client";

import { LOCKER_DAILY_PRICE, type GuestFormRow } from "@/hooks/use-reservation-form";

type ReservationGuestFieldsProps = {
  guest: GuestFormRow;
  guestIndex: number;
  stayNights: number;
  isPrincipal?: boolean;
  variant?: "marketing" | "dashboard";
  showLockerFields?: boolean;
  /** Reception can assign a locker number; guests only choose service and days. */
  showLockerNumberField?: boolean;
  /** When false, only locker controls are shown (e.g. recurring guest already identified). */
  showIdentityFields?: boolean;
  contactRequired?: boolean;
  enablePhoneMatching?: boolean;
  onLookupPhone?: () => void;
  onMatchDecision?: (decision: "reuse" | "create_new") => void;
  onChange: (field: keyof GuestFormRow, value: string | number) => void;
};

export function ReservationGuestFields({
  guest,
  guestIndex,
  stayNights,
  isPrincipal = guestIndex === 0,
  variant = "marketing",
  showLockerFields = false,
  showLockerNumberField = false,
  showIdentityFields = true,
  contactRequired = true,
  enablePhoneMatching = false,
  onLookupPhone,
  onMatchDecision,
  onChange,
}: ReservationGuestFieldsProps) {
  const isDashboard = variant === "dashboard";
  // Dashboard walk-in form sits on `.dashboard-brand-panel` (dark teal) — use light text.
  const inputClass = isDashboard
    ? "w-full rounded-lg border border-white/25 bg-white px-3 py-2 text-sm text-text-main placeholder:text-text-muted"
    : "w-full rounded-xl border border-mkt-border bg-white px-3 py-2.5 text-sm text-mkt-ink placeholder:text-mkt-ink-muted";
  const labelClass = isDashboard
    ? "mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-accent"
    : "mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-mkt-terracotta";
  const hintClass = isDashboard
    ? "mt-1 text-xs leading-relaxed text-white/90"
    : "mt-1 text-xs text-white/70";

  return (
    <div className="space-y-3">
      {showIdentityFields ? (
        <>
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
            placeholder={`Teléfono${contactRequired ? " *" : " (opcional)"}`}
            value={guest.phone}
            required={contactRequired}
            autoComplete={isPrincipal ? "tel" : "off"}
            onChange={(e) => onChange("phone", e.target.value)}
          />
          {enablePhoneMatching && guest.phone.trim() ? (
            <div className="rounded-lg border border-border-soft bg-surface-soft p-3">
              <button
                type="button"
                disabled={guest.phone_lookup_status === "searching"}
                onClick={onLookupPhone}
                className="rounded-lg border border-border-soft bg-white px-3 py-1.5 text-xs font-semibold text-text-main disabled:opacity-50"
              >
                {guest.phone_lookup_status === "searching" ? "Buscando…" : "Buscar coincidencia"}
              </button>
              {guest.phone_lookup_status === "none" ? (
                <p className="mt-2 text-xs text-text-muted">No hay coincidencias; se creará un registro nuevo.</p>
              ) : null}
              {guest.phone_lookup_status === "error" ? (
                <p className="mt-2 text-xs text-red-700">Ingresa un teléfono mexicano válido de 10 dígitos.</p>
              ) : null}
              {guest.matched_guest ? (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                  <p className="font-semibold">Coincidencia: {guest.matched_guest.full_name}</p>
                  <p className="mt-1">
                    {guest.matched_guest.phone}
                    {guest.matched_guest.email ? ` · ${guest.matched_guest.email}` : ""}
                  </p>
                  <p className="mt-2">
                    Reutilizar conserva el perfil tal como está; no sobrescribe nombre, correo ni sexo.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onMatchDecision?.("reuse")}
                      className={`rounded-full px-3 py-1.5 font-semibold ${
                        guest.match_decision === "reuse"
                          ? "bg-emerald-700 text-white"
                          : "border border-emerald-700 bg-white text-emerald-800"
                      }`}
                    >
                      Reutilizar este huésped
                    </button>
                    <button
                      type="button"
                      onClick={() => onMatchDecision?.("create_new")}
                      className={`rounded-full px-3 py-1.5 font-semibold ${
                        guest.match_decision === "create_new"
                          ? "bg-slate-800 text-white"
                          : "border border-slate-500 bg-white text-slate-800"
                      }`}
                    >
                      Crear registro nuevo
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <input
            type="email"
            className={inputClass}
            placeholder={`Correo electrónico${contactRequired ? " *" : " (opcional)"}`}
            value={guest.email}
            required={contactRequired}
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
        </>
      ) : null}
      {showLockerFields ? (
        <>
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
              {showLockerNumberField ? (
                <div>
                  <label className={labelClass}>Código de locker (opcional)</label>
                  <input
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    className={`${inputClass} max-w-[140px] uppercase`}
                    placeholder="Ej. 12 o A1"
                    value={guest.locker_number}
                    onChange={(e) => onChange("locker_number", e.target.value)}
                  />
                  <p className={hintClass}>
                    Letras y/o números. Déjalo vacío si aún no asignas el locker.
                  </p>
                </div>
              ) : (
                <p className={hintClass}>
                  El código de locker se asigna en recepción al llegar.
                </p>
              )}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
