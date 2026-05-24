"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DiscountRule } from "@/lib/discount-rules";

type DiscountRulesPanelProps = {
  initialRules: DiscountRule[];
};

export function DiscountRulesPanel({ initialRules }: DiscountRulesPanelProps) {
  const [rules, setRules] = useState<DiscountRule[]>(initialRules);
  const [editing, setEditing] = useState<DiscountRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/discount-rules");
    if (res.ok) {
      const data = await res.json();
      setRules(data);
    }
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name") as string,
      type: form.get("type") as string,
      valid_from: form.get("type") === "date_range" ? (form.get("valid_from") as string) || null : null,
      valid_until: form.get("type") === "date_range" ? (form.get("valid_until") as string) || null : null,
      loyalty_min_stays: form.get("type") === "loyalty" ? Number(form.get("loyalty_min_stays")) || 0 : 0,
      loyalty_within_days: form.get("type") === "loyalty" ? Number(form.get("loyalty_within_days")) || 0 : 0,
      discount_percent: Number(form.get("discount_percent")) || 0,
      is_active: form.get("is_active") === "on",
    };

    if (!payload.name || payload.discount_percent <= 0) {
      setError("Nombre y porcentaje son requeridos.");
      setSaving(false);
      return;
    }

    const url = editing ? `/api/admin/discount-rules?id=${editing.id}` : "/api/admin/discount-rules";
    const method = editing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setEditing(null);
      setIsCreating(false);
      await refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al guardar.");
    }
    setSaving(false);
  };

  const handleToggle = async (rule: DiscountRule) => {
    const res = await fetch(`/api/admin/discount-rules?id=${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rule, is_active: !rule.is_active }),
    });
    if (res.ok) await refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta regla de descuento?")) return;
    const res = await fetch(`/api/admin/discount-rules?id=${id}`, { method: "DELETE" });
    if (res.ok) await refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-main">Reglas de descuento</h2>
        {!isCreating && !editing && (
          <Button
            onClick={() => {
              setIsCreating(true);
              setEditing(null);
            }}
          >
            + Nueva regla
          </Button>
        )}
      </div>

      {(isCreating || editing) && (
        <Card>
          <form onSubmit={handleSave} className="space-y-4 p-4">
            <h3 className="text-sm font-semibold">
              {editing ? "Editar regla" : "Nueva regla de descuento"}
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Nombre</label>
                <input
                  name="name"
                  defaultValue={editing?.name ?? ""}
                  required
                  className="w-full rounded-lg border border-border-soft px-3 py-2 text-sm"
                  placeholder="Ej. Día de la Mujer"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Tipo</label>
                <select
                  name="type"
                  defaultValue={editing?.type ?? "date_range"}
                  className="w-full rounded-lg border border-border-soft px-3 py-2 text-sm"
                >
                  <option value="date_range">Rango de fechas</option>
                  <option value="loyalty">Cliente frecuente</option>
                </select>
              </div>
            </div>

            {/* Date range fields */}
            <div className="grid gap-3 sm:grid-cols-2" id="date-range-fields">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Fecha inicio</label>
                <input
                  name="valid_from"
                  type="date"
                  defaultValue={editing?.valid_from ?? ""}
                  className="w-full rounded-lg border border-border-soft px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Fecha fin</label>
                <input
                  name="valid_until"
                  type="date"
                  defaultValue={editing?.valid_until ?? ""}
                  className="w-full rounded-lg border border-border-soft px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Loyalty fields */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Mín. estancias previas</label>
                <input
                  name="loyalty_min_stays"
                  type="number"
                  min={1}
                  defaultValue={editing?.loyalty_min_stays ?? 2}
                  className="w-full rounded-lg border border-border-soft px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Dentro de los últimos (días)</label>
                <input
                  name="loyalty_within_days"
                  type="number"
                  min={1}
                  defaultValue={editing?.loyalty_within_days ?? 15}
                  className="w-full rounded-lg border border-border-soft px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Descuento (%)</label>
                <input
                  name="discount_percent"
                  type="number"
                  min={0.5}
                  max={100}
                  step={0.5}
                  defaultValue={editing?.discount_percent ?? 10}
                  required
                  className="w-full rounded-lg border border-border-soft px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    name="is_active"
                    type="checkbox"
                    defaultChecked={editing?.is_active ?? true}
                    className="h-4 w-4 rounded border-border-soft"
                  />
                  Activa
                </label>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null);
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

      {/* Rules list */}
      <div className="space-y-2">
        {rules.length === 0 && (
          <p className="py-4 text-center text-sm text-text-muted">
            No hay reglas de descuento configuradas.
          </p>
        )}
        {rules.map((rule) => (
          <Card key={rule.id}>
            <div className="flex items-center justify-between p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-main">{rule.name}</span>
                  <Badge variant={rule.type === "loyalty" ? "default" : "warning"}>
                    {rule.type === "date_range" ? "Fechas" : "Frecuencia"}
                  </Badge>
                  <Badge variant={rule.is_active ? "success" : "default"}>
                    {rule.is_active ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {rule.type === "date_range"
                    ? `Del ${rule.valid_from} al ${rule.valid_until}`
                    : `≥ ${rule.loyalty_min_stays} estancias en ${rule.loyalty_within_days} días`}
                  {" · "}
                  <span className="font-semibold text-brand-primary">{rule.discount_percent}% descuento</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => handleToggle(rule)}>
                  {rule.is_active ? "Desactivar" : "Activar"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(rule);
                    setIsCreating(false);
                  }}
                >
                  Editar
                </Button>
                <Button variant="outline" onClick={() => handleDelete(rule.id)}>
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