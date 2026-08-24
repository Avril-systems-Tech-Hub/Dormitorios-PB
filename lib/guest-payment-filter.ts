export type GuestPaymentFilter = "all" | "paid" | "debt";

function pickFirst(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseGuestPaymentFilter(
  params: Record<string, string | string[] | undefined>,
  paramPrefix?: string,
): GuestPaymentFilter {
  const key = paramPrefix ? `${paramPrefix}_paymentFilter` : "paymentFilter";
  const raw = pickFirst(params[key]);
  if (raw === "paid" || raw === "debt") return raw;
  return "all";
}

/** Pagado = liquidated; deudor = cualquier otro estado (pending/partial). */
export function matchesGuestPaymentFilter(
  paymentStatus: string | null | undefined,
  filter: GuestPaymentFilter,
): boolean {
  if (filter === "all") return true;
  const paid = paymentStatus === "liquidated";
  return filter === "paid" ? paid : !paid;
}
