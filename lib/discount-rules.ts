/**
 * Discount rules helpers.
 * Queries discount_rules from Supabase to find applicable discounts.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export type DiscountRule = {
  id: string;
  name: string;
  type: "date_range" | "loyalty";
  valid_from: string | null;
  valid_until: string | null;
  loyalty_min_stays: number;
  loyalty_within_days: number;
  discount_percent: number;
  is_active: boolean;
};

export type ApplicableDiscount = {
  rule: DiscountRule;
  reason: string;
};

/**
 * Get all active discount rules (for admin panel).
 */
export async function getAllDiscountRules(): Promise<DiscountRule[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("discount_rules")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as DiscountRule[];
}

/**
 * Deactivate all currently active discount rules.
 */
export async function deactivateAllDiscountRules(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discount_rules")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("is_active", true)
    .select("id");

  if (error) {
    throw new Error(`Error deactivating discount rules: ${error.message}`);
  }

  return data?.length ?? 0;
}

/**
 * Find applicable discounts for a given reservation.
 * - checkInDate: ISO date string (YYYY-MM-DD)
 * - guestPhone: optional, used for loyalty discounts
 *
 * Returns the best applicable discount (highest percentage).
 */
export async function getApplicableDiscounts(
  checkInDate: string,
  guestPhone?: string,
): Promise<ApplicableDiscount[]> {
  const admin = createAdminClient();
  const discounts: ApplicableDiscount[] = [];

  // 1. Date-range discounts
  const { data: dateRangeRules } = await admin
    .from("discount_rules")
    .select("*")
    .eq("type", "date_range")
    .eq("is_active", true)
    .lte("valid_from", checkInDate)
    .gte("valid_until", checkInDate);

  for (const rule of dateRangeRules ?? []) {
    discounts.push({
      rule: rule as DiscountRule,
      reason: `Descuento "${rule.name}" vigente del ${rule.valid_from} al ${rule.valid_until}`,
    });
  }

  // 2. Loyalty discounts (if phone provided)
  if (guestPhone) {
    const { data: loyaltyRules } = await admin
      .from("discount_rules")
      .select("*")
      .eq("type", "loyalty")
      .eq("is_active", true);

    for (const rule of loyaltyRules ?? []) {
      const dr = rule as DiscountRule;
      if (dr.loyalty_min_stays <= 0 || dr.loyalty_within_days <= 0) continue;

      // Count previous stays for this phone number within the lookback window
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - dr.loyalty_within_days);
      const sinceStr = sinceDate.toISOString().slice(0, 10);

      const { count } = await admin
        .from("guests")
        .select("id", { count: "exact", head: true })
        .eq("phone", guestPhone)
        .gte("created_at", `${sinceStr}T00:00:00`);

      if ((count ?? 0) >= dr.loyalty_min_stays) {
        discounts.push({
          rule: dr,
          reason: `Cliente frecuente: ${count} estancias en los últimos ${dr.loyalty_within_days} días`,
        });
      }
    }
  }

  return discounts;
}

/**
 * Get the best discount (highest percentage) from applicable discounts.
 */
export function getBestDiscount(discounts: ApplicableDiscount[]): ApplicableDiscount | null {
  if (discounts.length === 0) return null;
  return discounts.reduce((best, current) =>
    current.rule.discount_percent > best.rule.discount_percent ? current : best,
  );
}

/**
 * Apply discount percent to a total amount.
 */
export function applyDiscount(total: number, percent: number): {
  original: number;
  discountAmount: number;
  finalTotal: number;
} {
  const discountAmount = Math.round(total * (percent / 100) * 100) / 100;
  return {
    original: total,
    discountAmount,
    finalTotal: Math.max(0, total - discountAmount),
  };
}