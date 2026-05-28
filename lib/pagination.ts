/**
 * Helpers para paginación server-side.
 * Las páginas leen searchParams y arman la consulta a Supabase usando `.range(from, to)` + `{ count: 'exact' }`.
 */

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type PaginationInput = {
  page: number;
  pageSize: number;
  q: string;
};

function pickFirst(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parsePagination(
  params: Record<string, string | string[] | undefined>,
  prefix?: string,
): PaginationInput {
  const p = prefix ? `${prefix}_` : "";
  const pageRaw = Number(pickFirst(params[`${p}page`]));
  const pageSizeRaw = Number(pickFirst(params[`${p}pageSize`]));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 0;
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeRaw)
    ? pageSizeRaw
    : DEFAULT_PAGE_SIZE;
  const q = pickFirst(params[`${p}q`]).trim();
  return { page, pageSize, q };
}

/**
 * Calcula `[from, to]` inclusivos para usar con `supabase.range(from, to)`.
 */
export function getRange(page: number, pageSize: number): [number, number] {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  return [from, to];
}

/**
 * Escapa caracteres que tienen significado especial en el filtro `.or()` de PostgREST.
 */
export function escapeIlike(value: string): string {
  return value.replace(/[,()]/g, " ");
}
