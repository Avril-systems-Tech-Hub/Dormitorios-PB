import { NextRequest, NextResponse } from "next/server";
import { getAllPromoCodes, generatePromoCodeBatch, togglePromoCodeActive } from "@/lib/promo-codes";

/** GET /api/admin/promo-codes — list all promo codes */
export async function GET() {
  const codes = await getAllPromoCodes();
  return NextResponse.json(codes);
}

/** POST /api/admin/promo-codes — generate a batch of promo codes */
export async function POST(req: NextRequest) {
  const body = await req.json();

  const { prefix, discountPercent, validFrom, validUntil, maxUses, quantity, batchName } = body;

  if (!prefix || !discountPercent || !validFrom || !validUntil || !quantity || !batchName) {
    return NextResponse.json({ error: "Faltan campos requeridos." }, { status: 400 });
  }

  if (discountPercent <= 0 || discountPercent > 100) {
    return NextResponse.json({ error: "El porcentaje debe estar entre 1 y 100." }, { status: 400 });
  }

  if (quantity < 1 || quantity > 500) {
    return NextResponse.json({ error: "La cantidad debe ser entre 1 y 500." }, { status: 400 });
  }

  try {
    const codes = await generatePromoCodeBatch({
      prefix,
      discountPercent,
      validFrom,
      validUntil,
      maxUses: maxUses || 1,
      quantity,
      batchName,
    });
    return NextResponse.json(codes);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al generar códigos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** PUT /api/admin/promo-codes?id=... — toggle active status */
export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json();
  await togglePromoCodeActive(id, body.is_active);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/promo-codes?id=... — delete a promo code */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin.from("promo_codes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}