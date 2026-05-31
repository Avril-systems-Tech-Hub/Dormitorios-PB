"use client";

import { useState, useMemo, useCallback, useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { FilterableCell } from "@/components/ui/filterable-cell";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";

function isFilterableCellObject(cell: FilterableCell): cell is { __filterText: string; node: ReactNode } {
  return (
    cell !== null &&
    typeof cell === "object" &&
    !Array.isArray(cell) &&
    "__filterText" in cell &&
    "node" in cell
  );
}

function getCellNode(cell: FilterableCell): ReactNode {
  if (isFilterableCellObject(cell)) return cell.node;
  return cell;
}

function getCellText(cell: FilterableCell): string {
  if (isFilterableCellObject(cell)) return cell.__filterText;
  return extractText(cell);
}

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (typeof node === "object" && !(node instanceof Promise)) {
    const el = node as unknown as Record<string, unknown>;
    if (el.props && typeof el.props === "object") {
      const props = el.props as Record<string, unknown>;
      if ("children" in props && props.children !== undefined && props.children !== null) {
        return extractText(props.children as ReactNode);
      }
    }
  }
  return "";
}

export type ServerPagination = {
  /** 0-indexed current page. */
  page: number;
  pageSize: number;
  totalCount: number;
  /** Current `?q=` value (used to hydrate the search input). */
  searchQuery?: string;
  /** Placeholder for the global search input when supported. */
  searchPlaceholder?: string;
  /** Prefix for URL params (`{prefix}_page`, `{prefix}_pageSize`, `{prefix}_q`). Useful when there are multiple tables on the same page. */
  paramPrefix?: string;
};

export function ResponsiveTable({
  headers,
  rows,
  filterMode = "columns",
  dense = false,
  serverPagination,
}: {
  headers: string[];
  rows: FilterableCell[][];
  /** "columns" = filter per column (default). "global" = single search across all cells. */
  filterMode?: "columns" | "global";
  /** Tighter rows and top-aligned cells for detail-heavy tables. */
  dense?: boolean;
  /** When provided, pagination is driven by URL searchParams (?page, ?pageSize, ?q). */
  serverPagination?: ServerPagination;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isServer = !!serverPagination;

  const [filters, setFilters] = useState<Record<number, string>>({});
  const [globalQuery, setGlobalQuery] = useState("");
  const [searchInput, setSearchInput] = useState(serverPagination?.searchQuery ?? "");
  const [clientPage, setClientPage] = useState(0);
  const [clientPageSize, setClientPageSize] = useState(10);

  // Sincroniza el input de búsqueda cuando el URL cambia desde afuera.
  useEffect(() => {
    setSearchInput(serverPagination?.searchQuery ?? "");
  }, [serverPagination?.searchQuery]);

  const textRows = useMemo(
    () => rows.map((row) => row.map(getCellText)),
    [rows],
  );

  const filteredIndices = useMemo(() => {
    if (isServer) return rows.map((_, i) => i);
    if (filterMode === "global") {
      const q = globalQuery.trim().toLowerCase();
      if (!q) return rows.map((_, i) => i);
      return rows.reduce<number[]>((acc, _row, idx) => {
        const rowText = textRows[idx].join(" ").toLowerCase();
        if (rowText.includes(q)) acc.push(idx);
        return acc;
      }, []);
    }

    const activeFilters = Object.entries(filters).filter(([, v]) => v.trim());
    if (!activeFilters.length) return rows.map((_, i) => i);

    return rows.reduce<number[]>((acc, _row, idx) => {
      const textRow = textRows[idx];
      const matches = activeFilters.every(([colIdx, filterVal]) => {
        const cellText = textRow[Number(colIdx)] ?? "";
        return cellText.toLowerCase().includes(filterVal.toLowerCase());
      });
      if (matches) acc.push(idx);
      return acc;
    }, []);
  }, [isServer, rows, textRows, filters, filterMode, globalQuery]);

  const totalFiltered = isServer
    ? serverPagination!.totalCount
    : filteredIndices.length;
  const pageSize = isServer ? serverPagination!.pageSize : clientPageSize;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = isServer
    ? Math.min(serverPagination!.page, totalPages - 1)
    : Math.min(clientPage, totalPages - 1);

  const paginatedIndices = useMemo(() => {
    if (isServer) return filteredIndices;
    return filteredIndices.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  }, [isServer, filteredIndices, currentPage, pageSize]);

  const setFilter = useCallback((colIdx: number, value: string) => {
    setFilters((prev) => ({ ...prev, [colIdx]: value }));
    setClientPage(0);
  }, []);

  // Construye una nueva URL preservando los searchParams existentes.
  const buildUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams],
  );

  const prefix = serverPagination?.paramPrefix ? `${serverPagination.paramPrefix}_` : "";
  const pageKey = `${prefix}page`;
  const pageSizeKey = `${prefix}pageSize`;
  const queryKey = `${prefix}q`;

  const goToPage = useCallback(
    (page: number) => {
      if (isServer) {
        router.push(buildUrl({ [pageKey]: page > 0 ? String(page) : null }));
      } else {
        setClientPage(page);
      }
    },
    [isServer, router, buildUrl, pageKey],
  );

  const changePageSize = useCallback(
    (size: number) => {
      if (isServer) {
        router.push(buildUrl({ [pageSizeKey]: size === 10 ? null : String(size), [pageKey]: null }));
      } else {
        setClientPageSize(size);
        setClientPage(0);
      }
    },
    [isServer, router, buildUrl, pageKey, pageSizeKey],
  );

  const submitSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      router.push(buildUrl({ [queryKey]: trimmed || null, [pageKey]: null }));
    },
    [router, buildUrl, queryKey, pageKey],
  );

  const thClass = dense ? "px-3 py-2 text-xs font-semibold uppercase tracking-wide" : "px-4 py-3 font-medium";
  const tdClass = dense
    ? "px-3 py-2 align-top text-sm text-text-main"
    : "px-4 py-3 align-top text-text-main";

  const visibleStart = totalFiltered === 0 ? 0 : currentPage * pageSize + 1;
  const visibleEnd = Math.min(totalFiltered, (currentPage + 1) * pageSize);

  return (
    <div className="max-w-full overflow-hidden rounded-xl border border-border-soft bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft bg-gray-50/50 px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>Mostrar</span>
            <select
              value={pageSize}
              onChange={(e) => changePageSize(Number(e.target.value))}
              className="rounded-md border border-border-soft bg-white px-2 py-1 text-sm text-text-main"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>registros</span>
          </div>
          {filterMode === "global" && !isServer ? (
            <input
              type="search"
              placeholder="Buscar por nombre, teléfono, email, folio…"
              value={globalQuery}
              onChange={(e) => {
                setGlobalQuery(e.target.value);
                setClientPage(0);
              }}
              className="h-8 min-w-[12rem] flex-1 rounded-lg border border-border-soft bg-white px-3 text-sm text-text-main outline-none focus:border-brand-primary/50 sm:min-w-[16rem] sm:max-w-md"
            />
          ) : null}
          {filterMode === "global" && isServer ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch(searchInput);
              }}
              className="flex flex-1 items-center gap-2"
            >
              <input
                type="search"
                placeholder={serverPagination?.searchPlaceholder ?? "Buscar…"}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-8 min-w-[12rem] flex-1 rounded-lg border border-border-soft bg-white px-3 text-sm text-text-main outline-none focus:border-brand-primary/50 sm:min-w-[16rem] sm:max-w-md"
              />
              <button
                type="submit"
                className="rounded-md bg-mkt-slate px-3 py-1 text-xs font-medium text-white hover:opacity-90"
              >
                Buscar
              </button>
              {serverPagination?.searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    submitSearch("");
                  }}
                  className="rounded-md border border-border-soft bg-white px-3 py-1 text-xs font-medium text-text-main hover:bg-gray-50"
                >
                  Limpiar
                </button>
              ) : null}
            </form>
          ) : null}
        </div>
        <span className="text-xs text-text-muted">
          {isServer ? (
            totalFiltered === 0 ? (
              "0 resultados"
            ) : (
              <>
                Mostrando <span className="font-medium text-text-main">{visibleStart}</span>–
                <span className="font-medium text-text-main">{visibleEnd}</span> de{" "}
                <span className="font-medium text-text-main">{totalFiltered}</span>
              </>
            )
          ) : (
            <>
              {totalFiltered} resultado{totalFiltered !== 1 ? "s" : ""}
              {totalFiltered !== rows.length && ` (de ${rows.length} total)`}
            </>
          )}
        </span>
      </div>

      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className={`w-full ${dense ? "text-sm" : "text-sm"}`}>
            <thead className="bg-surface-soft text-left text-text-muted">
              <tr>
                {headers.map((header, i) => (
                  <th key={header} className={thClass}>
                    <div>{header}</div>
                    {filterMode === "columns" && !isServer ? (
                      <input
                        type="text"
                        placeholder="Filtrar…"
                        value={filters[i] ?? ""}
                        onChange={(e) => setFilter(i, e.target.value)}
                        className="mt-1 w-full rounded border border-border-soft bg-white px-2 py-1 text-xs font-normal text-text-main outline-none focus:border-mkt-slate"
                      />
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedIndices.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="px-4 py-6 text-center text-sm text-text-muted">
                    Sin resultados
                  </td>
                </tr>
              ) : (
                paginatedIndices.map((idx) => (
                  <tr key={idx} className="border-t border-border-soft hover:bg-surface-soft/40">
                    {rows[idx].map((cell, cellIdx) => (
                      <td key={cellIdx} className={tdClass}>
                        {getCellNode(cell)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {paginatedIndices.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-muted">Sin resultados</p>
        ) : (
          paginatedIndices.map((idx) => (
            <div key={idx} className="rounded-lg border border-border-soft p-3">
              {rows[idx].map((cell, cellIdx) => (
                <div key={cellIdx} className="flex justify-between gap-2 border-b border-border-soft/60 py-2 text-sm last:border-0">
                  <span className="shrink-0 text-text-muted">{headers[cellIdx]}</span>
                  <span className="min-w-0 text-right text-text-main">{getCellNode(cell)}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft bg-gray-50/50 px-4 py-2">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => goToPage(Math.max(0, currentPage - 1))}
            className="rounded-md border border-border-soft bg-white px-3 py-1 text-xs font-medium text-text-main transition hover:bg-gray-50 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => {
              if (totalPages > 7) {
                if (i === 0 || i === totalPages - 1 || (i >= currentPage - 1 && i <= currentPage + 1)) {
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goToPage(i)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        i === currentPage
                          ? "bg-mkt-slate text-white"
                          : "border border-border-soft bg-white text-text-main hover:bg-gray-50"
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                }
                if (i === currentPage - 2 || i === currentPage + 2) {
                  return (
                    <span key={i} className="px-1 text-xs text-text-muted">
                      …
                    </span>
                  );
                }
                return null;
              }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => goToPage(i)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    i === currentPage
                      ? "bg-mkt-slate text-white"
                      : "border border-border-soft bg-white text-text-main hover:bg-gray-50"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={currentPage >= totalPages - 1}
            onClick={() => goToPage(Math.min(totalPages - 1, currentPage + 1))}
            className="rounded-md border border-border-soft bg-white px-3 py-1 text-xs font-medium text-text-main transition hover:bg-gray-50 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
