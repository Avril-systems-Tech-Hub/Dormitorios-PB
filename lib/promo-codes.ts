/**
 * Promo codes helpers.
 * Generate, validate, and redeem promotional discount codes.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export type PromoCode = {
  id: string;
  code: string;
  discount_percent: number;
  valid_from: string;
  valid_until: string;
  max_uses: number;
  current_uses: number;
  batch_name: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

export type PromoCodeValidation = {
  valid: boolean;
  promo?: PromoCode;
  error?: string;
};

/**
 * Generate a random alphanumeric suffix (uppercase + digits, no confusing chars).
 */
function randomSuffix(length = 4): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Generate unique promo codes with a given prefix.
 */
export function generateCodeStrings(prefix: string, quantity: number): string[] {
  const codes: Set<string> = new Set();
  const cleanPrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  while (codes.size < quantity) {
    codes.add(`${cleanPrefix}-${randomSuffix()}`);
  }
  return [...codes];
}

/**
 * Validate a promo code without redeeming it.
 * Returns the promo code data if valid, or an error message.
 */
export async function validatePromoCode(code: string): Promise<PromoCodeValidation> {
  if (!code || code.trim().length < 3) {
    return { valid: false, error: "Código demasiado corto." };
  }

  const admin = createAdminClient();
  const normalizedCode = code.trim().toUpperCase();

  const { data: promo, error } = await admin
    .from("promo_codes")
    .select("*")
    .eq("code", normalizedCode)
    .maybeSingle();

  if (error || !promo) {
    return { valid: false, error: "Código no encontrado." };
  }

  if (!promo.is_active) {
    return { valid: false, error: "Este código ha sido desactivado." };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (promo.valid_from > today) {
    return { valid: false, error: `Este código será válido a partir del ${promo.valid_from}.` };
  }
  if (promo.valid_until < today) {
    return { valid: false, error: "Este código ha expirado." };
  }

  if (promo.current_uses >= promo.max_uses) {
    return { valid: false, error: "Este código ya alcanzó el límite de usos." };
  }

  return { valid: true, promo: promo as PromoCode };
}

/**
 * Redeem a promo code (atomic increment via RPC function).
 * Returns the promo code data if redeemed, or an error message.
 */
export async function redeemPromoCode(code: string): Promise<PromoCodeValidation> {
  if (!code || code.trim().length < 3) {
    return { valid: false, error: "Código demasiado corto." };
  }

  const admin = createAdminClient();
  const normalizedCode = code.trim().toUpperCase();

  try {
    // Try atomic RPC first
    const { data, error } = await admin.rpc("redeem_promo_code", { p_code: normalizedCode });

    if (error) {
      console.warn("[redeemPromoCode] RPC failed, falling back to direct UPDATE:", error.message);
      // Fallback: SELECT + UPDATE (non-atomic but works without RPC)
      const { data: existing } = await admin
        .from("promo_codes")
        .select("*")
        .eq("code", normalizedCode)
        .eq("is_active", true)
        .single();

      if (!existing) {
        return { valid: false, error: "Código inválido o expirado." };
      }

      const newUses = (existing.current_uses ?? 0) + 1;
      const { data: updated, error: updateError } = await admin
        .from("promo_codes")
        .update({ current_uses: newUses })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (updateError || !updated) {
        console.error("[redeemPromoCode] Direct UPDATE failed:", updateError?.message);
        return { valid: false, error: "Error al canjear el código." };
      }

      console.log("[redeemPromoCode] Code redeemed via fallback:", normalizedCode, "uses:", newUses);
      return { valid: true, promo: updated as PromoCode };
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return { valid: false, error: "Código inválido o expirado." };
    }

    const redeemed = Array.isArray(data) ? data[0] : data;

    // Fetch full promo code data
    const { data: promo } = await admin
      .from("promo_codes")
      .select("*")
      .eq("code", redeemed.code || normalizedCode)
      .single();

    console.log("[redeemPromoCode] Code redeemed via RPC:", normalizedCode);
    return { valid: true, promo: promo as PromoCode };
  } catch (err) {
    console.error("[redeemPromoCode] Exception:", err);

    // Last resort fallback: direct update
    try {
      const { data: existing } = await admin
        .from("promo_codes")
        .select("*")
        .eq("code", normalizedCode)
        .eq("is_active", true)
        .single();

      if (!existing) {
        return { valid: false, error: "Código inválido o expirado." };
      }

      const newUses = (existing.current_uses ?? 0) + 1;
      const { data: updated, error: updateError } = await admin
        .from("promo_codes")
        .update({ current_uses: newUses })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (updateError || !updated) {
        return { valid: false, error: "Error al canjear el código." };
      }

      console.log("[redeemPromoCode] Code redeemed via catch fallback:", normalizedCode, "uses:", newUses);
      return { valid: true, promo: updated as PromoCode };
    } catch {
      return { valid: false, error: "Error al canjear el código." };
    }
  }
}

/**
 * Generate and insert a batch of promo codes into the database.
 */
export async function generatePromoCodeBatch(params: {
  prefix: string;
  discountPercent: number;
  validFrom: string;
  validUntil: string;
  maxUses: number;
  quantity: number;
  batchName: string;
  createdBy?: string | null;
}): Promise<PromoCode[]> {
  const admin = createAdminClient();
  const codeStrings = generateCodeStrings(params.prefix, params.quantity);

  const inserts = codeStrings.map((code) => ({
    code,
    discount_percent: params.discountPercent,
    valid_from: params.validFrom,
    valid_until: params.validUntil,
    max_uses: params.maxUses,
    current_uses: 0,
    batch_name: params.batchName,
    is_active: true,
    created_by: params.createdBy || null,
  }));

  const { data, error } = await admin
    .from("promo_codes")
    .insert(inserts)
    .select("*");

  if (error) {
    throw new Error(`Error generating promo codes: ${error.message}`);
  }

  return (data ?? []) as PromoCode[];
}

/**
 * Get all promo codes (for admin panel).
 */
export async function getAllPromoCodes(): Promise<PromoCode[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as PromoCode[];
}

/**
 * Toggle promo code active status.
 */
export async function togglePromoCodeActive(codeId: string, isActive: boolean): Promise<void> {
  const admin = createAdminClient();
  await admin.from("promo_codes").update({ is_active: isActive }).eq("id", codeId);
}

/**
 * Deactivate all currently active promo codes.
 */
export async function deactivateAllPromoCodes(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("promo_codes")
    .update({ is_active: false })
    .eq("is_active", true)
    .select("id");

  if (error) {
    throw new Error(`Error deactivating promo codes: ${error.message}`);
  }

  return data?.length ?? 0;
}

/**
 * Get unique batch names for filtering.
 */
export async function getPromoCodeBatches(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("promo_codes")
    .select("batch_name")
    .order("batch_name");
  const unique = [...new Set((data ?? []).map((r) => r.batch_name))];
  return unique;
}