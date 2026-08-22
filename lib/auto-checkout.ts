import { createAdminClient } from "@/lib/supabase/admin";
import { getMexicoCityDateString, hasStayPeriodEnded, stayPeriodEndAt } from "@/lib/dates";

const CLOSED_CHUNK = 100;

type LiquidatedOpenStay = {
  id: string;
  check_out_date: string | null;
  folios?: { payment_status?: string | null } | { payment_status?: string | null }[] | null;
};

let rpcAvailable: boolean | null = null;

/**
 * Closes liquidated stays whose 11:00 CDMX period has already ended.
 * Unpaid/partial folios stay open so amber remains a cash-control signal.
 */
export async function autoCloseLiquidatedStays() {
  try {
    const admin = createAdminClient();
    if (rpcAvailable !== false) {
      const { error } = await admin.rpc("auto_close_liquidated_stays");
      if (!error) {
        rpcAvailable = true;
        return;
      }
      if (!isMissingRpc(error.message)) {
        console.error("[autoCloseLiquidatedStays]", error.message);
        return;
      }
      rpcAvailable = false;
    }
    await closeLiquidatedStaysInApp(admin);
  } catch (error) {
    console.error("[autoCloseLiquidatedStays]", error);
  }
}

function isMissingRpc(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("could not find the function") || lower.includes("does not exist");
}

function folioPaymentStatus(folios: LiquidatedOpenStay["folios"]) {
  if (folios == null) return "";
  return (Array.isArray(folios) ? folios[0] : folios)?.payment_status ?? "";
}

async function closeLiquidatedStaysInApp(
  admin: ReturnType<typeof createAdminClient>,
) {
  const now = new Date();
  const today = getMexicoCityDateString(now);
  const endedToday = hasStayPeriodEnded(today, now);
  const pageSize = 1000;
  const rows: LiquidatedOpenStay[] = [];

  for (let from = 0; ; from += pageSize) {
    let query = admin
      .from("reservations")
      .select("id, check_out_date, folios(payment_status)")
      .is("checked_out_at", null)
      .not("status", "in", '("cancelled","checked_out")');

    query = endedToday ? query.lte("check_out_date", today) : query.lt("check_out_date", today);

    const { data, error } = await query
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)
      .returns<LiquidatedOpenStay[]>();
    if (error) {
      console.error("[autoCloseLiquidatedStays] fallback select", error.message);
      return;
    }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }

  const liquidated = rows.filter((row) => folioPaymentStatus(row.folios) === "liquidated");
  if (!liquidated.length) return;

  const idsByCheckout = new Map<string, string[]>();
  for (const row of liquidated) {
    if (!row.check_out_date) continue;
    const current = idsByCheckout.get(row.check_out_date) ?? [];
    current.push(row.id);
    idsByCheckout.set(row.check_out_date, current);
  }

  for (const [checkOutDate, ids] of idsByCheckout) {
    const checkedOutAt = stayPeriodEndAt(checkOutDate);
    for (let i = 0; i < ids.length; i += CLOSED_CHUNK) {
      const chunk = ids.slice(i, i + CLOSED_CHUNK);
      const { error: updateError } = await admin
        .from("reservations")
        .update({
          status: "checked_out",
          checked_out_at: checkedOutAt,
        })
        .in("id", chunk)
        .is("checked_out_at", null);
      if (updateError) {
        console.error("[autoCloseLiquidatedStays] fallback update", updateError.message);
        return;
      }
    }
  }
}
