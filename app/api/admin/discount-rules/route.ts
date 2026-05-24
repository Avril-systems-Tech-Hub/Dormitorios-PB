import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAllDiscountRules } from "@/lib/discount-rules";

/** GET /api/admin/discount-rules — list all rules */
export async function GET() {
  const rules = await getAllDiscountRules();
  return NextResponse.json(rules);
}

/** POST /api/admin/discount-rules — create a rule */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discount_rules")
    .insert({
      name: body.name,
      type: body.type,
      valid_from: body.valid_from || null,
      valid_until: body.valid_until || null,
      loyalty_min_stays: body.loyalty_min_stays || 0,
      loyalty_within_days: body.loyalty_within_days || 0,
      discount_percent: body.discount_percent,
      is_active: body.is_active !== false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

/** PUT /api/admin/discount-rules?id=... — update a rule */
export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discount_rules")
    .update({
      name: body.name,
      type: body.type,
      valid_from: body.valid_from || null,
      valid_until: body.valid_until || null,
      loyalty_min_stays: body.loyalty_min_stays || 0,
      loyalty_within_days: body.loyalty_within_days || 0,
      discount_percent: body.discount_percent,
      is_active: body.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

/** DELETE /api/admin/discount-rules?id=... — delete a rule */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("discount_rules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}