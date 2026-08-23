"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/guards";
import {
  SERVICE_PRICE_KEYS,
  SERVICE_PRICE_LABELS,
  type ServicePrices,
} from "@/lib/service-prices";

export type UpdateServicePricesResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function parseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999.99) return null;
  return Number(amount.toFixed(2));
}

export async function updateServicePricesAction(
  formData: FormData,
): Promise<UpdateServicePricesResult> {
  const actor = await requireRole(["admin"]);
  const next: Partial<ServicePrices> = {};

  for (const key of SERVICE_PRICE_KEYS) {
    const parsed = parseAmount(String(formData.get(key) ?? ""));
    if (parsed == null) {
      return {
        ok: false,
        message: `Indica un precio válido mayor a cero para ${SERVICE_PRICE_LABELS[key].toLowerCase()}.`,
      };
    }
    next[key] = parsed;
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  for (const key of SERVICE_PRICE_KEYS) {
    const { error } = await admin
      .from("service_prices")
      .update({ amount: next[key], updated_at: now })
      .eq("key", key);
    if (error) {
      console.error("[updateServicePricesAction]", key, error);
      return { ok: false, message: `No se pudo guardar ${SERVICE_PRICE_LABELS[key]}: ${error.message}` };
    }
  }

  await admin.from("audit_logs").insert({
    actor_user_id: actor.id,
    action: "service_prices_updated",
    entity_type: "service_prices",
    metadata: {
      amounts: next,
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/register-stay");
  revalidatePath("/dashboard");
  revalidatePath("/");

  return { ok: true, message: "Precios actualizados. Los nuevos cobros usarán estas tarifas." };
}
