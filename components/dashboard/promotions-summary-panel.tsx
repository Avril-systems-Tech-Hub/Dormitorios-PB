"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DiscountRule } from "@/lib/discount-rules";
import type { PromoCode } from "@/lib/promo-codes";

type PromotionsSummaryPanelProps = {
  initialCodes: PromoCode[];
  initialRules: DiscountRule[];
};

type PromoBatchSummary = {
  batchName: string;
  count: number;
  discountPercent: number;
  validFrom: string;
  validUntil: string;
};

function groupPromoBatches(codes: PromoCode[]): PromoBatchSummary[] {
  const map = new Map<string, PromoBatchSummary>();

  for (const code of codes) {
    const existing = map.get(code.batch_name);
    if (existing) {
      existing.count += 1;
      continue;
    }

    map.set(code.batch_name, {
      batchName: code.batch_name,
      count: 1,
      discountPercent: code.discount_percent,
      validFrom: code.valid_from,
      validUntil: code.valid_until,
    });
  }

  return [...map.values()].sort((a, b) => a.batchName.localeCompare(b.batchName, "es"));
}

function formatRuleDetail(rule: DiscountRule): string {
  if (rule.type === "date_range") {
    return `Del ${rule.valid_from} al ${rule.valid_until} · ${rule.discount_percent}% descuento`;
  }

  return `≥ ${rule.loyalty_min_stays} estancias en ${rule.loyalty_within_days} días · ${rule.discount_percent}% descuento`;
}

export function PromotionsSummaryPanel({
  initialCodes,
  initialRules,
}: PromotionsSummaryPanelProps) {
  const [codes, setCodes] = useState(initialCodes);
  const [rules, setRules] = useState(initialRules);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const refresh = useCallback(async () => {
    const [codesRes, rulesRes] = await Promise.all([
      fetch("/api/admin/promo-codes"),
      fetch("/api/admin/discount-rules"),
    ]);

    if (codesRes.ok) {
      setCodes(await codesRes.json());
    }
    if (rulesRes.ok) {
      setRules(await rulesRes.json());
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      void refresh();
    };
    window.addEventListener("promotions-updated", handler);
    return () => window.removeEventListener("promotions-updated", handler);
  }, [refresh]);

  const activeRules = useMemo(() => rules.filter((rule) => rule.is_active), [rules]);
  const inactiveRules = useMemo(() => rules.filter((rule) => !rule.is_active), [rules]);
  const activeCodes = useMemo(() => codes.filter((code) => code.is_active), [codes]);
  const inactiveCodes = useMemo(() => codes.filter((code) => !code.is_active), [codes]);
  const activeBatches = useMemo(() => groupPromoBatches(activeCodes), [activeCodes]);
  const inactiveBatches = useMemo(() => groupPromoBatches(inactiveCodes), [inactiveCodes]);

  const activeTotal = activeRules.length + activeCodes.length;
  const inactiveTotal = inactiveRules.length + inactiveCodes.length;

  const handleDeactivateAll = async () => {
    if (activeTotal === 0) return;

    const confirmed = confirm(
      `¿Desactivar todas las promociones activas?\n\n` +
        `${activeRules.length} regla(s) de descuento y ${activeCodes.length} código(s) promo quedarán inactivos.`,
    );
    if (!confirmed) return;

    setDeactivating(true);
    setError("");
    setSuccessMsg("");

    const res = await fetch("/api/admin/promotions/deactivate-all", { method: "POST" });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setSuccessMsg(
        `Se desactivaron ${data.total} promoción(es): ${data.discountRules} regla(s) y ${data.promoCodes} código(s).`,
      );
      await refresh();
      window.dispatchEvent(new CustomEvent("promotions-updated"));
    } else {
      setError(data.error || "Error al desactivar promociones.");
    }

    setDeactivating(false);
  };

  return (
    <Card>
      <div className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-main">Resumen de promociones</h2>
            <p className="mt-1 text-sm text-text-muted">
              Estado actual de reglas de descuento y códigos promo en el sistema.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleDeactivateAll}
            disabled={deactivating || activeTotal === 0}
          >
            {deactivating ? "Desactivando..." : "Desactivar todas"}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text-main">Activas</p>
              <Badge variant="success">{activeTotal}</Badge>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {activeRules.length} regla(s) · {activeCodes.length} código(s) en {activeBatches.length}{" "}
              campaña(s)
            </p>

            {activeTotal === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No hay promociones activas.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {activeRules.map((rule) => (
                  <li key={rule.id} className="rounded-lg bg-white/70 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-text-main">{rule.name}</span>
                      <Badge variant="default">Regla</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">{formatRuleDetail(rule)}</p>
                  </li>
                ))}
                {activeBatches.map((batch) => (
                  <li key={batch.batchName} className="rounded-lg bg-white/70 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-text-main">{batch.batchName}</span>
                      <Badge variant="default">Códigos</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {batch.count} código(s) · {batch.discountPercent}% descuento · del{" "}
                      {batch.validFrom} al {batch.validUntil}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border-soft bg-surface-soft/50 p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text-main">Inactivas</p>
              <Badge variant="default">{inactiveTotal}</Badge>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {inactiveRules.length} regla(s) · {inactiveCodes.length} código(s) en{" "}
              {inactiveBatches.length} campaña(s)
            </p>

            {inactiveTotal === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No hay promociones inactivas.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {inactiveRules.map((rule) => (
                  <li key={rule.id} className="rounded-lg bg-white/70 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-text-main">{rule.name}</span>
                      <Badge variant="default">Regla</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">{formatRuleDetail(rule)}</p>
                  </li>
                ))}
                {inactiveBatches.map((batch) => (
                  <li key={batch.batchName} className="rounded-lg bg-white/70 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-text-main">{batch.batchName}</span>
                      <Badge variant="default">Códigos</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {batch.count} código(s) · {batch.discountPercent}% descuento · del{" "}
                      {batch.validFrom} al {batch.validUntil}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {successMsg && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {successMsg}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Card>
  );
}
