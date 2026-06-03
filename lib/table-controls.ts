export type SortDirection = "asc" | "desc";

export type TableColumnFilterOption = {
  value: string;
  label: string;
};

export type TableColumnConfig = {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  /** @deprecated Use filterOptions with range values instead. */
  numeric?: boolean;
  filterOptions?: TableColumnFilterOption[];
};

export type NumericRangeFilter = {
  min?: number;
  max?: number;
};

export const ALL_FILTER_OPTION: TableColumnFilterOption = { value: "", label: "Todos" };

function pickFirst(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseTableSort(
  params: Record<string, string | string[] | undefined>,
  allowedColumns: readonly string[],
  defaultColumn: string,
  defaultDirection: SortDirection = "desc",
  prefix = "",
): { column: string; direction: SortDirection } {
  const p = prefix ? `${prefix}_` : "";
  const rawColumn = pickFirst(params[`${p}sort`]);
  const rawDirection = pickFirst(params[`${p}dir`]);
  const column = allowedColumns.includes(rawColumn) ? rawColumn : defaultColumn;
  const direction: SortDirection =
    rawDirection === "asc" || rawDirection === "desc" ? rawDirection : defaultDirection;
  return { column, direction };
}

export function parseColumnFilters(
  params: Record<string, string | string[] | undefined>,
  allowedKeys: readonly string[],
  prefix = "cf_",
): Record<string, string> {
  const filters: Record<string, string> = {};
  for (const key of allowedKeys) {
    const value = pickFirst(params[`${prefix}${key}`]).trim();
    if (value) filters[key] = value;
  }
  return filters;
}

export function parseNumericFilter(value: string): number | null {
  const normalized = value.replace(/[$,\s]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parses range tokens like `300-800`, `1500+`, or `8+`. */
export function parseNumericRangeFilter(value: string): NumericRangeFilter | null {
  const raw = value.trim();
  if (!raw) return null;
  if (raw.endsWith("+")) {
    const min = Number(raw.slice(0, -1));
    return Number.isFinite(min) ? { min } : null;
  }
  if (raw.includes("-")) {
    const [minRaw, maxRaw] = raw.split("-");
    const min = Number(minRaw);
    const max = Number(maxRaw);
    if (Number.isFinite(min) && Number.isFinite(max)) return { min, max };
  }
  const exact = parseNumericFilter(raw);
  return exact != null ? { min: exact, max: exact } : null;
}

export function matchesNumericRange(amount: number, value: string): boolean {
  const range = parseNumericRangeFilter(value);
  if (!range) return true;
  if (range.min != null && amount < range.min) return false;
  if (range.max != null && amount > range.max) return false;
  return true;
}

export function nextSortState(
  currentColumn: string | null,
  currentDirection: SortDirection,
  clickedColumn: string,
): { column: string | null; direction: SortDirection } {
  if (currentColumn !== clickedColumn) {
    return { column: clickedColumn, direction: "desc" };
  }
  if (currentDirection === "desc") {
    return { column: clickedColumn, direction: "asc" };
  }
  return { column: null, direction: "desc" };
}
