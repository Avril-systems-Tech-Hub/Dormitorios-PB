"use client";

import { useMemo, useState } from "react";

type ReservationFormProps = {
  action: (formData: FormData) => Promise<void>;
  beds: { bed_number: number }[];
  recurringGuest: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    sex?: string | null;
  } | null;
};

type FieldErrors = Partial<Record<"full_name" | "phone" | "email" | "check_in_date" | "check_out_date", string>>;

export function ReservationForm({ action, beds, recurringGuest }: ReservationFormProps) {
  const [values, setValues] = useState({
    full_name: recurringGuest?.full_name ?? "",
    phone: recurringGuest?.phone ?? "",
    email: recurringGuest?.email ?? "",
    check_in_date: "",
    check_out_date: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const errors = useMemo<FieldErrors>(() => {
    const next: FieldErrors = {};
    if (!values.full_name.trim()) next.full_name = "Nombre requerido.";
    if (!/^\d{10,15}$/.test(values.phone.replace(/\D/g, ""))) next.phone = "Teléfono inválido (10-15 dígitos).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = "Correo inválido.";
    if (!values.check_in_date) next.check_in_date = "Selecciona fecha de entrada.";
    if (!values.check_out_date) next.check_out_date = "Selecciona fecha de salida.";
    if (values.check_in_date && values.check_out_date && values.check_out_date <= values.check_in_date) {
      next.check_out_date = "La salida debe ser posterior al check-in.";
    }
    return next;
  }, [values]);

  const showError = (name: keyof FieldErrors) => (submitAttempted || touched[name]) && Boolean(errors[name]);

  return (
    <form
      action={action}
      className="rounded-3xl border border-[#d8d4ce] bg-white p-6 shadow-sm"
      onSubmit={() => setSubmitAttempted(true)}
      noValidate
    >
      <input type="hidden" name="return_to" value="/#reserva" />
      <input type="hidden" name="reservation_source" value="guest_app" />
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <input
            name="full_name"
            className="w-full rounded-xl border border-[#d9d9d9] px-3 py-2 text-sm"
            placeholder="Nombre completo"
            defaultValue={values.full_name}
            required
            onChange={(e) => setValues((prev) => ({ ...prev, full_name: e.target.value }))}
            onBlur={() => setTouched((prev) => ({ ...prev, full_name: true }))}
          />
          {showError("full_name") ? <p className="mt-1 text-xs text-red-600">{errors.full_name}</p> : null}
        </div>
        <div>
          <input
            name="phone"
            className="w-full rounded-xl border border-[#d9d9d9] px-3 py-2 text-sm"
            placeholder="Teléfono"
            defaultValue={values.phone}
            required
            onChange={(e) => setValues((prev) => ({ ...prev, phone: e.target.value }))}
            onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
          />
          {showError("phone") ? <p className="mt-1 text-xs text-red-600">{errors.phone}</p> : null}
        </div>
        <div>
          <input
            name="email"
            type="email"
            className="w-full rounded-xl border border-[#d9d9d9] px-3 py-2 text-sm"
            placeholder="Correo"
            defaultValue={values.email}
            required
            onChange={(e) => setValues((prev) => ({ ...prev, email: e.target.value }))}
            onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
          />
          {showError("email") ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
        </div>
        <select
          name="sex"
          className="rounded-xl border border-[#d9d9d9] bg-white px-3 py-2 text-sm"
          defaultValue={recurringGuest?.sex ?? "unknown"}
        >
          <option value="unknown">Sexo</option>
          <option value="f">Femenino</option>
          <option value="m">Masculino</option>
          <option value="x">Otro</option>
        </select>
        <div>
          <input
            name="check_in_date"
            type="date"
            className="w-full rounded-xl border border-[#d9d9d9] px-3 py-2 text-sm"
            required
            onChange={(e) => setValues((prev) => ({ ...prev, check_in_date: e.target.value }))}
            onBlur={() => setTouched((prev) => ({ ...prev, check_in_date: true }))}
          />
          {showError("check_in_date") ? <p className="mt-1 text-xs text-red-600">{errors.check_in_date}</p> : null}
        </div>
        <div>
          <input
            name="check_out_date"
            type="date"
            className="w-full rounded-xl border border-[#d9d9d9] px-3 py-2 text-sm"
            required
            onChange={(e) => setValues((prev) => ({ ...prev, check_out_date: e.target.value }))}
            onBlur={() => setTouched((prev) => ({ ...prev, check_out_date: true }))}
          />
          {showError("check_out_date") ? <p className="mt-1 text-xs text-red-600">{errors.check_out_date}</p> : null}
        </div>
        <select name="bed_number" className="rounded-xl border border-[#d9d9d9] bg-white px-3 py-2 text-sm">
          <option value="">Cama (manual)</option>
          {beds.map((bed) => (
            <option key={bed.bed_number} value={bed.bed_number}>
              Cama {bed.bed_number}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-xl border border-[#d9d9d9] px-3 py-2 text-sm text-[#436276]">
          <input name="auto_assign" type="checkbox" className="h-4 w-4" />
          Autoasignar cama libre
        </label>
        <input name="locker_number" className="rounded-xl border border-[#d9d9d9] px-3 py-2 text-sm" placeholder="N. locker (opcional)" />
        <input name="locker_price" type="number" step="0.01" min="0" className="rounded-xl border border-[#d9d9d9] px-3 py-2 text-sm" placeholder="Precio locker" />
        <input name="locker_days" type="number" min="0" className="rounded-xl border border-[#d9d9d9] px-3 py-2 text-sm" placeholder="Días locker" />
        <input name="extras_amount" type="number" step="0.01" min="0" className="rounded-xl border border-[#d9d9d9] px-3 py-2 text-sm" placeholder="Extras" />
      </div>
      <textarea
        name="notes"
        className="mt-3 min-h-20 w-full rounded-xl border border-[#d9d9d9] px-3 py-2 text-sm"
        placeholder="Notas de la reservación"
      />
      <p className="mt-3 text-xs text-[#567183]">Se aplican $10 MXN de bonificación por cama al capturar datos completos.</p>
      <button className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-full bg-[#1f5a78] text-sm font-semibold text-white hover:bg-[#184860]">
        Generar folio de reserva
      </button>
    </form>
  );
}
