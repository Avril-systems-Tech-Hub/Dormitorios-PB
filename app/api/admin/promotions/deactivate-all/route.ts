import { NextResponse } from "next/server";
import { deactivateAllDiscountRules } from "@/lib/discount-rules";
import { deactivateAllPromoCodes } from "@/lib/promo-codes";

/** POST /api/admin/promotions/deactivate-all — deactivate all active promotions */
export async function POST() {
  try {
    const [promoCodes, discountRules] = await Promise.all([
      deactivateAllPromoCodes(),
      deactivateAllDiscountRules(),
    ]);

    return NextResponse.json({
      ok: true,
      promoCodes,
      discountRules,
      total: promoCodes + discountRules,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al desactivar promociones.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
