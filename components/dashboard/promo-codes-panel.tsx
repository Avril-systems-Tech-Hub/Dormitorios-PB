"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PromoCode } from "@/lib/promo-codes";

type PromoCodesPanelProps = {
  initialCodes: PromoCode[];
};

export function PromoCodesPanel({ initialCodes }: PromoCodesPanelProps) {
  const [codes, setCodes] = useState<PromoCode[]>(initialCodes);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [filterBatch, setFilterBatch] = useState<string>("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const batches = [...new Set(codes.map((c) => c.batch_name))];

  const filtered = filterBatch === "all" ? codes : codes.filter((c) => c.batch_name === filterBatch);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/promo-codes");
    if (res.ok) {
      const data = await res.json();
      setCodes(data);
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      void refresh();
    };
    window.addEventListener("promotions-updated", handler);
    return () => window.removeEventListener("promotions-updated", handler);
  }, [refresh]);

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMsg("");

    const form = new FormData(e.currentTarget);
    const payload = {
      prefix: (form.get("prefix") as string).trim().toUpperCase(),
      discountPercent: Number(form.get("discount_percent")) || 0,
      validFrom: form.get("valid_from") as string,
      validUntil: form.get("valid_until") as string,
      maxUses: Number(form.get("max_uses")) || 1,
      quantity: Number(form.get("quantity")) || 1,
      batchName: (form.get("batch_name") as string).trim(),
    };

    if (!payload.prefix || !payload.discountPercent || !payload.validFrom || !payload.validUntil || !payload.batchName) {
      setError("Todos los campos son requeridos.");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const generated = await res.json();
      setSuccessMsg(`Se generaron ${generated.length} códigos para "${payload.batchName}".`);
      setIsCreating(false);
      await refresh();
      window.dispatchEvent(new CustomEvent("promotions-updated"));
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al generar códigos.");
    }
    setSaving(false);
  };

  const handleToggle = async (code: PromoCode) => {
    const res = await fetch(`/api/admin/promo-codes?id=${code.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !code.is_active }),
    });
    if (res.ok) {
      await refresh();
      window.dispatchEvent(new CustomEvent("promotions-updated"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este código promo?")) return;
    const res = await fetch(`/api/admin/promo-codes?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      await refresh();
      window.dispatchEvent(new CustomEvent("promotions-updated"));
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-main">Códigos de descuento</h2>
        {!isCreating && (
          <Button
            onClick={() => {
              setIsCreating(true);
              setError("");
              setSuccessMsg("");
            }}
          >
            + Generar códigos
          </Button>
        )}
      </div>

      {isCreating && (
        <Card>
          <form onSubmit={handleGenerate} className="space-y-4 p-4">
            <h3 className="text-sm font-semibold">Generar lote de códigos</h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Nombre de la campaña</label>
                <input
                  name="batch_name"
                  required
                  className="w-full rounded-lg border border-border-soft px-3 py-2 text-sm"
                  placeholder="Ej. Promo Verano 2026"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Prefijo del código</label>
                <input
                  name="prefix"
                  required
                  maxLength={12}
                  className="w-full rounded-lg border border-border-soft px-3 py-2 text-sm uppercase"
                  placeholder="Ej. VERANO"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Descuento (%)</label>
                <input
                  name="discount_percent"
                  type="number"
                  min={1}
                  max={100}
                  step={0.5}
                  defaultValue={10}
                  required
                  className="w-full rounded-lg border border-border-soft px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Usos máximos por código</label>
                <input
                  name="max_uses"
                  type="number"
                  min={1}
                  defaultValue={1}
                  required
                  className="w-full rounded-lg border border-border-soft px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Vigencia desde</label>
                <input
                  name="valid_from"
                  type="date"
                  required
                  className="w-full rounded-lg border border-border-soft px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Vigencia hasta</label>
                <input
                  name="valid_until"
                  type="date"
                  required
                  className="w-full rounded-lg border border-border-soft px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Cantidad de códigos</label>
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  max={500}
                  defaultValue={10}
                  required
                  className="w-full rounded-lg border border-border-soft px-3 py-2 text-sm"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Generando..." : "Generar códigos"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setError("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {successMsg && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
          {successMsg}
        </div>
      )}

      {/* Filter by batch */}
      {batches.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-muted">Filtrar por campaña:</span>
          <select
            value={filterBatch}
            onChange={(e) => setFilterBatch(e.target.value)}
            className="rounded-lg border border-border-soft px-3 py-1.5 text-sm"
          >
            <option value="all">Todas ({codes.length})</option>
            {batches.map((b) => (
              <option key={b} value={b}>
                {b} ({codes.filter((c) => c.batch_name === b).length})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Codes list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-text-muted">
            No hay códigos de descuento. Genera el primer lote.
          </p>
        )}
        {filtered.map((code) => (
          <Card key={code.id}>
            <div className="flex items-center justify-between p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-sm font-semibold text-text-main">
                    {code.code}
                  </code>
                  <Badge variant={code.is_active ? "success" : "default"}>
                    {code.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                  {code.current_uses >= code.max_uses && (
                    <Badge variant="warning">Agotado</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {code.batch_name}
                  {" · "}
                  <span className="font-semibold text-brand-primary">{code.discount_percent}% descuento</span>
                  {" · "}
                  {code.current_uses}/{code.max_uses} usos
                  {" · "}
                  Válido del {code.valid_from} al {code.valid_until}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => copyCode(code.code)}
                  className="text-xs"
                >
                  {copiedCode === code.code ? "✓ Copiado" : "Copiar"}
                </Button>
                <Button variant="outline" onClick={() => handleToggle(code)}>
                  {code.is_active ? "Desactivar" : "Activar"}
                </Button>
                <Button variant="outline" onClick={() => handleDelete(code.id)}>
                  Eliminar
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}