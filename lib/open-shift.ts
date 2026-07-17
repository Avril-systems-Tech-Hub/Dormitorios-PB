import { createAdminClient } from "@/lib/supabase/admin";

export type OpenShiftInfo = {
  id: string;
  opened_at: string;
  opened_by: string;
  opened_by_name: string | null;
};

export async function getOpenShift(profileId: string): Promise<OpenShiftInfo | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("shifts")
    .select("id, opened_at, opened_by, open_by:opened_by(full_name)")
    .eq("status", "open")
    .eq("opened_by", profileId)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const opener = data.open_by as { full_name?: string } | undefined;
  return {
    id: data.id,
    opened_at: data.opened_at,
    opened_by: data.opened_by,
    opened_by_name: opener?.full_name ?? null,
  };
}

export function formatOpenShiftLabel(shift: OpenShiftInfo): string {
  const when = new Date(shift.opened_at).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const who = shift.opened_by_name ?? "Recepción";
  return `Turno de ${who} · desde ${when}`;
}

export async function getShiftExpenseTotal(shiftId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("cash_movements")
    .select("amount")
    .eq("direction", "expense")
    .eq("shift_id", shiftId);

  return (data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}

export async function getShiftExpenseCount(shiftId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("cash_movements")
    .select("id", { count: "exact", head: true })
    .eq("direction", "expense")
    .eq("shift_id", shiftId);

  return count ?? 0;
}
