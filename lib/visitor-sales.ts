import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeLockerCode } from "@/lib/locker";
import type { PaymentMethod } from "@/types/domain";

export const VISITOR_CONCEPTS = ["shower", "locker"] as const;
export type VisitorConcept = (typeof VISITOR_CONCEPTS)[number];

export const VISITOR_CONCEPT_LABELS: Record<VisitorConcept, string> = {
  shower: "Regadera",
  locker: "Locker",
};

export const VISITOR_RESOURCE_LABELS: Record<VisitorConcept, string> = {
  shower: "Número de regadera",
  locker: "Número de locker",
};

export const VISITOR_TABLES: Record<VisitorConcept, "visitor_shower_sales" | "visitor_locker_sales"> = {
  shower: "visitor_shower_sales",
  locker: "visitor_locker_sales",
};

export const VISITOR_PRICE_KEYS: Record<VisitorConcept, "visitor_shower" | "visitor_locker"> = {
  shower: "visitor_shower",
  locker: "visitor_locker",
};

export const VISITOR_REGISTRATION_CONCEPTS: Array<{
  value: VisitorConcept;
  label: string;
  description: string;
}> = [
  {
    value: "shower",
    label: "Regadera",
    description: "Invitado: se baña y se va. Pago de una exhibición, sin cama.",
  },
  {
    value: "locker",
    label: "Locker",
    description: "Invitado: usa casillero y se va. Pago de una exhibición, sin cama.",
  },
];

export function isVisitorConcept(value: string): value is VisitorConcept {
  return VISITOR_CONCEPTS.includes(value as VisitorConcept);
}

export function normalizeVisitorResourceNumber(raw: string): string | null {
  return normalizeLockerCode(raw);
}

export type VisitorSaleRow = {
  id: string;
  visitorName: string | null;
  resourceNumber: string;
  amount: number;
  method: PaymentMethod;
  soldAt: string;
  soldDate: string;
  notes: string | null;
  soldByName: string | null;
};

export type VisitorMethodTotals = {
  cash: number;
  transfer: number;
  card: number;
  total: number;
};

function emptyMethodTotals(): VisitorMethodTotals {
  return { cash: 0, transfer: 0, card: 0, total: 0 };
}

function addSaleToTotals(
  totals: VisitorMethodTotals,
  method: string | null | undefined,
  amount: number,
) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (method === "cash") totals.cash += amount;
  else if (method === "transfer") totals.transfer += amount;
  else if (method === "card") totals.card += amount;
  else return;
  totals.total += amount;
}

type SaleAmountRow = { amount?: number | string | null; method?: string | null };

export async function getVisitorSalesTotalsForShift(
  supabase: SupabaseClient,
  shiftId: string,
): Promise<VisitorMethodTotals> {
  const totals = emptyMethodTotals();
  const [{ data: showers }, { data: lockers }] = await Promise.all([
    supabase.from("visitor_shower_sales").select("amount, method").eq("shift_id", shiftId),
    supabase.from("visitor_locker_sales").select("amount, method").eq("shift_id", shiftId),
  ]);
  for (const row of [...(showers ?? []), ...(lockers ?? [])] as SaleAmountRow[]) {
    addSaleToTotals(totals, row.method, Number(row.amount ?? 0));
  }
  return {
    cash: Number(totals.cash.toFixed(2)),
    transfer: Number(totals.transfer.toFixed(2)),
    card: Number(totals.card.toFixed(2)),
    total: Number(totals.total.toFixed(2)),
  };
}

export async function getVisitorSalesTotalsForDates(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
): Promise<number> {
  const [{ data: showers }, { data: lockers }] = await Promise.all([
    supabase
      .from("visitor_shower_sales")
      .select("amount")
      .gte("sold_date", startDate)
      .lte("sold_date", endDate),
    supabase
      .from("visitor_locker_sales")
      .select("amount")
      .gte("sold_date", startDate)
      .lte("sold_date", endDate),
  ]);
  const total = [...(showers ?? []), ...(lockers ?? [])].reduce(
    (sum, row) => sum + Number((row as { amount?: number | string }).amount ?? 0),
    0,
  );
  return Number(total.toFixed(2));
}

type RawVisitorSale = {
  id: string;
  visitor_name?: string | null;
  resource_number: string;
  amount: number | string;
  method: PaymentMethod;
  sold_at: string;
  sold_date: string;
  notes?: string | null;
  profiles?: { full_name?: string } | { full_name?: string }[] | null;
};

function unwrap<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function mapVisitorSale(row: RawVisitorSale): VisitorSaleRow {
  return {
    id: row.id,
    visitorName: row.visitor_name?.trim() || null,
    resourceNumber: row.resource_number,
    amount: Number(row.amount ?? 0),
    method: row.method,
    soldAt: row.sold_at,
    soldDate: row.sold_date,
    notes: row.notes?.trim() || null,
    soldByName: unwrap(row.profiles)?.full_name ?? null,
  };
}

export async function listVisitorSales(
  supabase: SupabaseClient,
  concept: VisitorConcept,
  options: {
    startDate?: string | null;
    endDate?: string | null;
    from: number;
    to: number;
  },
): Promise<{ rows: VisitorSaleRow[]; totalCount: number }> {
  let query = supabase
    .from(VISITOR_TABLES[concept])
    .select(
      "id, visitor_name, resource_number, amount, method, sold_at, sold_date, notes, profiles:sold_by(full_name)",
      { count: "exact" },
    )
    .order("sold_at", { ascending: false })
    .range(options.from, options.to);

  if (options.startDate) query = query.gte("sold_date", options.startDate);
  if (options.endDate) query = query.lte("sold_date", options.endDate);

  const { data, count, error } = await query;
  if (error) {
    console.error(`[listVisitorSales] ${concept}:`, error.message);
    return { rows: [], totalCount: 0 };
  }

  return {
    rows: ((data ?? []) as RawVisitorSale[]).map(mapVisitorSale),
    totalCount: count ?? 0,
  };
}

export type VisitorSaleWithConcept = VisitorSaleRow & { concept: VisitorConcept };

export async function listVisitorSalesForPeriod(
  supabase: SupabaseClient,
  options: {
    startDate?: string | null;
    endDate?: string | null;
  } = {},
): Promise<VisitorSaleWithConcept[]> {
  const [showers, lockers] = await Promise.all([
    listVisitorSales(supabase, "shower", {
      startDate: options.startDate,
      endDate: options.endDate,
      from: 0,
      to: 4999,
    }),
    listVisitorSales(supabase, "locker", {
      startDate: options.startDate,
      endDate: options.endDate,
      from: 0,
      to: 4999,
    }),
  ]);

  return [
    ...showers.rows.map((row) => ({ ...row, concept: "shower" as const })),
    ...lockers.rows.map((row) => ({ ...row, concept: "locker" as const })),
  ].sort((a, b) => b.soldAt.localeCompare(a.soldAt));
}
