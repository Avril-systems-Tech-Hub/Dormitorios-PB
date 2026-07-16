"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMexicoCityDateString } from "@/lib/dates";
import { searchGuestByPhoneAction } from "@/actions/operations";

type HistoricalStayCaptureProps = {
  action: (formData: FormData) => Promise<void>;
  returnTo?: string;
  defaultExpanded?: boolean;
};

export function HistoricalStayCapture({
  action,
  returnTo = "/dashboard/imported-records",
  defaultExpanded = true,
}: HistoricalStayCaptureProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [guestNames, setGuestNames] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [total, setTotal] = useState("");
  const [payment, setPayment] = useState("0");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [matchedGuest, setMatchedGuest] = useState<{
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
  } | null>(null);
  const [matchDecision, setMatchDecision] = useState<"" | "reuse" | "create_new">("");
  const [lookupStatus, setLookupStatus] = useState<"idle" | "searching" | "none" | "error">("idle");

  const guests = useMemo(
    () =>
      guestNames
        .split("\n")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((full_name, index) => ({
          full_name,
          phone: index === 0 ? primaryPhone.trim() : "",
          email: index === 0 ? primaryEmail.trim() : "",
          sex: "unknown",
          guest_id: index === 0 && matchDecision === "reuse" ? matchedGuest?.id : undefined,
          match_decision: index === 0 && primaryPhone.trim() ? matchDecision || undefined : undefined,
        })),
    [guestNames, matchDecision, matchedGuest?.id, primaryEmail, primaryPhone],
  );
  const totalAmount = Number(total) || 0;
  const paidAmount = Number(payment) || 0;
  const balance = Math.max(0, totalAmount - paidAmount);

  return (
    <Card className="border-amber-300 bg-amber-50/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Solo administración · Archivo histórico
          </p>
          <h2 className="mt-1 text-lg font-semibold text-text-main">Registrar estancia ya terminada</h2>
          <p className="mt-1 max-w-3xl text-sm text-text-muted">
            Crea huéspedes, reservación, folio y abono real. No asigna cama y no bloquea inventario.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Ocultar captura" : "Añadir huésped histórico"}
        </Button>
      </div>

      {expanded ? <form
        action={action}
        className="mt-4 grid gap-3 lg:grid-cols-2"
        onSubmit={(event) => {
          if (!window.confirm(`Guardar ${guests.length} huésped(es) como estancia histórica terminada?`)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="return_to" value={returnTo} />
        <input type="hidden" name="guests_data" value={JSON.stringify(guests)} />

        <label className="grid gap-1 text-sm">
          Folio original
          <input
            name="folio_code"
            required
            placeholder="Ej. FPB-2024-0012"
            className="h-10 rounded border border-border-soft bg-white px-3"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Huéspedes (uno por línea)
          <textarea
            required
            value={guestNames}
            onChange={(event) => setGuestNames(event.target.value)}
            placeholder={"María López\nJosé Pérez"}
            className="min-h-24 rounded border border-border-soft bg-white px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm">
            Entrada histórica
            <input
              name="check_in_date"
              type="date"
              required
              max={getMexicoCityDateString()}
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
              className="h-10 rounded border border-border-soft bg-white px-3"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Salida histórica
            <input
              name="check_out_date"
              type="date"
              required
              max={getMexicoCityDateString()}
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
              className="h-10 rounded border border-border-soft bg-white px-3"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm">
            Teléfono principal (opcional)
            <input
              value={primaryPhone}
              onChange={(event) => {
                setPrimaryPhone(event.target.value);
                setMatchedGuest(null);
                setMatchDecision("");
                setLookupStatus("idle");
              }}
              className="h-10 rounded border border-border-soft bg-white px-3"
            />
            {primaryPhone.trim() ? (
              <div className="mt-2">
                <button
                  type="button"
                  disabled={lookupStatus === "searching"}
                  onClick={async () => {
                    setLookupStatus("searching");
                    const result = await searchGuestByPhoneAction(primaryPhone);
                    if (!result.success) {
                      setMatchedGuest(null);
                      setMatchDecision("");
                      setLookupStatus("error");
                      return;
                    }
                    if (!result.guest) {
                      setMatchedGuest(null);
                      setMatchDecision("create_new");
                      setLookupStatus("none");
                      return;
                    }
                    setMatchedGuest(result.guest);
                    setMatchDecision("");
                    setLookupStatus("idle");
                  }}
                  className="rounded border border-border-soft bg-white px-2 py-1 text-xs font-semibold"
                >
                  {lookupStatus === "searching" ? "Buscando…" : "Buscar coincidencia"}
                </button>
                {lookupStatus === "none" ? (
                  <p className="mt-1 text-xs text-text-muted">Sin coincidencia; se creará un huésped nuevo.</p>
                ) : null}
                {lookupStatus === "error" ? (
                  <p className="mt-1 text-xs text-red-700">Ingresa un teléfono mexicano válido de 10 dígitos.</p>
                ) : null}
                {matchedGuest ? (
                  <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs">
                    <p className="font-semibold">Coincidencia: {matchedGuest.full_name}</p>
                    <p>{matchedGuest.phone}{matchedGuest.email ? ` · ${matchedGuest.email}` : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setMatchDecision("reuse")}
                        className={matchDecision === "reuse" ? "font-semibold text-emerald-800" : "underline"}
                      >
                        Reutilizar sin modificar
                      </button>
                      <button
                        type="button"
                        onClick={() => setMatchDecision("create_new")}
                        className={matchDecision === "create_new" ? "font-semibold text-slate-900" : "underline"}
                      >
                        Crear registro nuevo
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </label>
          <label className="grid gap-1 text-sm">
            Email principal (opcional)
            <input
              type="email"
              value={primaryEmail}
              onChange={(event) => setPrimaryEmail(event.target.value)}
              className="h-10 rounded border border-border-soft bg-white px-3"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm">
            Total real
            <input
              name="total_amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={total}
              onChange={(event) => setTotal(event.target.value)}
              className="h-10 rounded border border-border-soft bg-white px-3"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Abono inicial real
            <input
              name="initial_payment"
              type="number"
              min="0"
              max={totalAmount || undefined}
              step="0.01"
              value={payment}
              onChange={(event) => setPayment(event.target.value)}
              className="h-10 rounded border border-border-soft bg-white px-3"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm">
            Método del abono
            <select name="payment_method" className="h-10 rounded border border-border-soft bg-white px-3">
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="card">Tarjeta</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Fecha efectiva de recepción
            <input
              name="effective_date"
              type="date"
              required={paidAmount > 0}
              max={getMexicoCityDateString()}
              defaultValue={checkOut}
              key={checkOut}
              className="h-10 rounded border border-border-soft bg-white px-3"
            />
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          Notas de la estancia
          <textarea name="notes" className="min-h-20 rounded border border-border-soft bg-white px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Notas del abono
          <textarea name="payment_notes" className="min-h-20 rounded border border-border-soft bg-white px-3 py-2" />
        </label>

        <div className="rounded-lg border border-amber-300 bg-white p-3 text-sm lg:col-span-2">
          <p className="font-semibold text-text-main">Resumen antes de guardar</p>
          <p className="mt-1 text-text-muted">
            {guests.length} huésped(es) · {checkIn || "sin entrada"} → {checkOut || "sin salida"} ·
            total ${totalAmount.toFixed(2)} · pagado ${paidAmount.toFixed(2)} · saldo ${balance.toFixed(2)}
          </p>
          <label className="mt-3 flex items-start gap-2 font-medium text-amber-900">
            <input name="historical_confirmation" type="checkbox" required className="mt-0.5 h-4 w-4" />
            Confirmo que la estancia terminó y que no debe ocupar ni reservar ninguna cama.
          </label>
        </div>
        <Button
          type="submit"
          disabled={
            !guests.length ||
            !checkIn ||
            !checkOut ||
            checkOut <= checkIn ||
            paidAmount > totalAmount ||
            Boolean(primaryPhone.trim() && !matchDecision)
          }
          className="lg:col-span-2"
        >
          Guardar estancia histórica
        </Button>
      </form> : null}
    </Card>
  );
}
