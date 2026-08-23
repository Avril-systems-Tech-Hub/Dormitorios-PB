"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getMexicoCityDateString } from "@/lib/dates";
import {
  isVisitorConcept,
  normalizeVisitorResourceNumber,
  VISITOR_CONCEPT_LABELS,
  VISITOR_PRICE_KEYS,
  VISITOR_TABLES,
  type VisitorConcept,
} from "@/lib/visitor-sales";
import { getServicePrices } from "@/lib/service-prices";
import { requireRole } from "@/lib/auth/guards";
import type { PaymentMethod } from "@/types/domain";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RegisterVisitorSaleResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

async function getActorProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();
  return profile ?? null;
}

export async function registerVisitorSaleAction(
  formData: FormData,
): Promise<RegisterVisitorSaleResult> {
  const actor = await getActorProfile();
  if (!actor || !["admin", "reception"].includes(actor.role)) {
    return { ok: false, message: "No tienes permiso para registrar este cobro." };
  }

  const conceptRaw = String(formData.get("concept") ?? "");
  if (!isVisitorConcept(conceptRaw)) {
    return { ok: false, message: "Concepto no válido." };
  }
  const concept: VisitorConcept = conceptRaw;

  const submissionId = String(formData.get("submission_id") ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) {
    return { ok: false, message: "No se pudo identificar este cobro. Recarga e intenta de nuevo." };
  }

  const visitorName = String(formData.get("visitor_name") ?? "").trim() || null;
  const resourceNumber = normalizeVisitorResourceNumber(String(formData.get("resource_number") ?? ""));
  if (!resourceNumber) {
    return {
      ok: false,
      message: `Indica el ${concept === "shower" ? "número de regadera" : "número de locker"}.`,
    };
  }

  const method = String(formData.get("method") ?? "cash") as PaymentMethod;
  if (!["cash", "transfer", "card"].includes(method)) {
    return { ok: false, message: "Método de pago no válido." };
  }

  const notes = String(formData.get("notes") ?? "").trim() || null;
  const soldDate = getMexicoCityDateString();
  const prices = await getServicePrices();
  const amount = prices[VISITOR_PRICE_KEYS[concept]];
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "El precio de este concepto no está configurado." };
  }

  const adminSupabase = createAdminClient();
  const { data: openShift } = await adminSupabase
    .from("shifts")
    .select("id")
    .eq("status", "open")
    .eq("opened_by", actor.id)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!openShift) {
    return { ok: false, message: "Inicia tu propio turno antes de cobrar a un invitado." };
  }

  const { data: inserted, error } = await adminSupabase
    .from(VISITOR_TABLES[concept])
    .insert({
      submission_id: submissionId,
      visitor_name: visitorName,
      resource_number: resourceNumber,
      amount,
      method,
      shift_id: openShift.id,
      sold_by: actor.id,
      sold_date: soldDate,
      notes,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { ok: true, message: "Este cobro ya estaba registrado." };
    }
    console.error("[registerVisitorSaleAction] insert failed:", error);
    return { ok: false, message: `No se pudo registrar el cobro: ${error.message}` };
  }

  await adminSupabase.from("audit_logs").insert({
    actor_user_id: actor.id,
    action: "visitor_sale_registered",
    entity_type: "visitor_sale",
    entity_id: inserted?.id ?? null,
    metadata: {
      concept,
      visitor_name: visitorName,
      resource_number: resourceNumber,
      amount,
      method,
      shift_id: openShift.id,
      sold_date: soldDate,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/register-stay");
  revalidatePath("/dashboard/guests");
  revalidatePath("/dashboard/cash-cuts");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/shifts");

  const label = VISITOR_CONCEPT_LABELS[concept];
  return {
    ok: true,
    message: `Cobro de ${label.toLowerCase()} ${resourceNumber}: $${amount.toFixed(2)} MXN.`,
  };
}

type VisitorSaleDeleteRow = {
  id: string;
  visitor_name?: string | null;
  resource_number: string;
  amount: number | string;
  method: PaymentMethod;
  shift_id: string;
  sold_at: string;
  sold_date: string;
  notes?: string | null;
  sold_by?: string | null;
};

async function recalculateCashCutForShift(
  supabase: ReturnType<typeof createAdminClient>,
  shiftId: string,
): Promise<boolean> {
  const { data: cut } = await supabase
    .from("cash_cuts")
    .select("id")
    .eq("shift_id", shiftId)
    .maybeSingle();
  if (!cut) return false;

  const { data: totals, error: totalsError } = await supabase.rpc(
    "shift_collected_by_method",
    { p_shift_id: shiftId },
  );
  if (totalsError) {
    console.error("[deleteVisitorSaleAction] cash cut totals failed:", totalsError);
    return false;
  }

  const row = (Array.isArray(totals) ? totals[0] : totals) as
    | { total_cash?: number | string; total_transfer?: number | string; total_card?: number | string }
    | null;
  const totalCash = Number(row?.total_cash ?? 0);
  const totalTransfer = Number(row?.total_transfer ?? 0);
  const totalCard = Number(row?.total_card ?? 0);

  const { data: movements } = await supabase
    .from("cash_movements")
    .select("amount, direction")
    .eq("shift_id", shiftId);

  const movementIncome = (movements ?? [])
    .filter((movement) => movement.direction === "income")
    .reduce((sum, movement) => sum + Number(movement.amount ?? 0), 0);
  const totalExpenses = (movements ?? [])
    .filter((movement) => movement.direction === "expense")
    .reduce((sum, movement) => sum + Number(movement.amount ?? 0), 0);

  const totalGuestIncome = Number((totalCash + totalTransfer + totalCard).toFixed(2));
  const netResult = Number((totalGuestIncome + movementIncome - totalExpenses).toFixed(2));

  const { error: updateError } = await supabase
    .from("cash_cuts")
    .update({
      total_cash: totalCash,
      total_transfer: totalTransfer,
      total_card: totalCard,
      total_income: netResult,
      total_guest_income: totalGuestIncome,
      total_expenses: totalExpenses,
      net_result: netResult,
      expected_income: netResult,
      actual_cash_counted: netResult,
      difference: 0,
      leakage_flag: false,
    })
    .eq("id", cut.id);

  if (updateError) {
    console.error("[deleteVisitorSaleAction] cash cut update failed:", updateError);
    return false;
  }
  return true;
}

export async function deleteVisitorSaleAction(
  formData: FormData,
): Promise<RegisterVisitorSaleResult> {
  const actor = await requireRole(["admin"]);

  const conceptRaw = String(formData.get("concept") ?? "");
  if (!isVisitorConcept(conceptRaw)) {
    return { ok: false, message: "Concepto no válido." };
  }
  const concept: VisitorConcept = conceptRaw;

  const saleId = String(formData.get("sale_id") ?? "").trim();
  if (!UUID_PATTERN.test(saleId)) {
    return { ok: false, message: "Cobro no válido." };
  }

  const table = VISITOR_TABLES[concept];
  const adminSupabase = createAdminClient();
  const { data: sale, error: loadError } = await adminSupabase
    .from(table)
    .select(
      "id, visitor_name, resource_number, amount, method, shift_id, sold_at, sold_date, notes, sold_by",
    )
    .eq("id", saleId)
    .maybeSingle();

  if (loadError) {
    console.error("[deleteVisitorSaleAction] load failed:", loadError);
    return { ok: false, message: `No se pudo leer el cobro: ${loadError.message}` };
  }
  if (!sale) {
    return { ok: false, message: "Cobro de invitado no encontrado." };
  }

  const saleRow = sale as VisitorSaleDeleteRow;
  const { error: deleteError } = await adminSupabase.from(table).delete().eq("id", saleId);
  if (deleteError) {
    console.error("[deleteVisitorSaleAction] delete failed:", deleteError);
    return { ok: false, message: `No se pudo eliminar el cobro: ${deleteError.message}` };
  }

  const cashCutRecalculated = saleRow.shift_id
    ? await recalculateCashCutForShift(adminSupabase, saleRow.shift_id)
    : false;

  await adminSupabase.from("audit_logs").insert({
    actor_user_id: actor.id,
    action: "visitor_sale_deleted",
    entity_type: "visitor_sale",
    entity_id: saleId,
    metadata: {
      concept,
      visitor_name: saleRow.visitor_name ?? null,
      resource_number: saleRow.resource_number,
      amount: Number(saleRow.amount ?? 0),
      method: saleRow.method,
      shift_id: saleRow.shift_id,
      sold_at: saleRow.sold_at,
      sold_date: saleRow.sold_date,
      notes: saleRow.notes ?? null,
      sold_by: saleRow.sold_by ?? null,
      cash_cut_recalculated: cashCutRecalculated,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/guests");
  revalidatePath("/dashboard/cash-cuts");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/shifts");

  const label = VISITOR_CONCEPT_LABELS[concept];
  const amount = Number(saleRow.amount ?? 0).toFixed(2);
  const cutMessage = cashCutRecalculated ? " También se recalculó el corte relacionado." : "";
  return {
    ok: true,
    message: `Se eliminó el cobro de ${label.toLowerCase()} ${saleRow.resource_number} ($${amount}).${cutMessage}`,
  };
}
