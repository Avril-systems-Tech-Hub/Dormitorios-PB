/** Short labels for guest roster / imports (matches legacy spreadsheet). */
export function formatGuestSexLabel(sex: string | null | undefined): string {
  const labels: Record<string, string> = {
    f: "F",
    m: "M",
    x: "X",
    unknown: "—",
  };
  return labels[sex ?? "unknown"] ?? "—";
}
