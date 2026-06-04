"use client";

import { useState, useMemo, useCallback, useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { FilterableCell } from "@/components/ui/filterable-cell";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { nextSortState, type SortDirection, type TableColumnConfig } from "@/lib/table-controls";
import { cn } from "@/lib/utils";

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
  /** Sum of the primary amount column for rows visible on this page. */
  visibleAmountTotal?: number;
  /** Label for `visibleAmountTotal`, e.g. "Total en página". */
  visibleAmountLabel?: string;
};

export function ResponsiveTable({
  headers,
  columns,
  rows,
  filterMode = "columns",
  dense = false,
  serverPagination,
  serverSort,
  serverColumnFilters,
  sortParamKey = "sort",
  dirParamKey = "dir",
  columnFilterPrefix = "cf_",
  mobileColumnIndices,
}: {
  headers?: string[];
  /** Optional column metadata for server-side sort/filter controls. */
  columns?: TableColumnConfig[];
  rows: FilterableCell[][];
  /** Subset of column indices for mobile card rows (default: all columns). */
  mobileColumnIndices?: number[];
  /** "columns" = filter per column (default). "global" = single search across all cells. */
  filterMode?: "columns" | "global";
  /** Tighter rows and top-aligned cells for detail-heavy tables. */
  dense?: boolean;
  /** When provided, pagination is driven by URL searchParams (?page, ?pageSize, ?q). */
  serverPagination?: ServerPagination;
  serverSort?: { column: string; direction: SortDirection } | null;
  serverColumnFilters?: Record<string, string>;
  sortParamKey?: string;
  dirParamKey?: string;
  columnFilterPrefix?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isServer = !!serverPagination;
  const tableColumns: TableColumnConfig[] =
    columns ?? (headers ?? []).map((label, index) => ({ key: String(index), label }));
  const tableHeaders = tableColumns.map((column) => column.label);
  const mobileIndices =
    mobileColumnIndices ??
    tableHeaders.map((_, index) => index);
  const hasServerColumnControls = isServer && tableColumns.some((column) => column.sortable || column.filterable);

  const [filters, setFilters] = useState<Record<number, string>>({});
  const [globalQuery, setGlobalQuery] = useState("");
  const [searchInput, setSearchInput] = useState(serverPagination?.searchQuery ?? "");
  const [columnFilterInputs, setColumnFilterInputs] = useState<Record<string, string>>(
    serverColumnFilters ?? {},
  );
  const [clientPage, setClientPage] = useState(0);
  const [clientPageSize, setClientPageSize] = useState(10);

  // Sincroniza el input de búsqueda cuando el URL cambia desde afuera.
  useEffect(() => {
    setSearchInput(serverPagination?.searchQuery ?? "");
  }, [serverPagination?.searchQuery]);

  useEffect(() => {
    setColumnFilterInputs(serverColumnFilters ?? {});
  }, [serverColumnFilters]);

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

  const submitColumnFilter = useCallback(
    (columnKey: string, value: string) => {
      router.push(
        buildUrl({
          [`${columnFilterPrefix}${columnKey}`]: value.trim() || null,
          [pageKey]: null,
        }),
      );
    },
    [router, buildUrl, columnFilterPrefix, pageKey],
  );

  const toggleSort = useCallback(
    (columnKey: string) => {
      const next = nextSortState(serverSort?.column ?? null, serverSort?.direction ?? "desc", columnKey);
      router.push(
        buildUrl({
          [sortParamKey]: next.column,
          [dirParamKey]: next.column ? next.direction : null,
          [pageKey]: null,
        }),
      );
    },
    [router, buildUrl, serverSort, sortParamKey, dirParamKey, pageKey],
  );

  const thClass = dense ? "px-3 py-2 text-xs font-semibold uppercase tracking-wide" : "px-4 py-3 font-medium";
  const tdClass = dense
    ? "px-3 py-2 align-top text-sm text-text-main"
    : "px-4 py-3 align-top text-text-main";

  const visibleStart = totalFiltered === 0 ? 0 : currentPage * pageSize + 1;
  const visibleEnd = Math.min(totalFiltered, (currentPage + 1) * pageSize);

  return (
    <div className="max-w-full rounded-xl border border-border-soft bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft bg-gray-50/50 px-3 py-2 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
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
        <div className="flex flex-wrap items-center gap-4">
          {isServer &&
          serverPagination?.visibleAmountTotal != null &&
          paginatedIndices.length > 0 ? (
            <p className="text-sm text-text-main">
              <span className="text-text-muted">
                {serverPagination.visibleAmountLabel ?? "Total en página"}:{" "}
              </span>
              <span className="font-semibold">
                ${serverPagination.visibleAmountTotal.toFixed(2)}
              </span>
            </p>
          ) : null}
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
      </div>

      <div className="hidden overflow-x-auto md:block">
        <div>
          <table className={`w-full ${dense ? "text-sm" : "text-sm"}`}>
            <thead className="bg-surface-soft text-left text-text-muted">
              <tr>
                {tableColumns.map((column, i) => {
                  const isSorted = serverSort?.column === column.key;
                  const sortIndicator = isSorted
                    ? serverSort?.direction === "asc"
                      ? " ↑"
                      : " ↓"
                    : "";
                  return (
                    <th key={column.key} className={thClass}>
                      {column.sortable && hasServerColumnControls ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          className={cn(
                            "inline-flex items-center gap-1 text-left font-medium transition hover:text-text-main",
                            isSorted && "text-text-main",
                          )}
                          aria-label={`Ordenar por ${column.label}`}
                        >
                          {column.label}
                          <span className="text-[10px]">{sortIndicator}</span>
                        </button>
                      ) : (
                        <div>{column.label}</div>
                      )}
                      {filterMode === "columns" && !isServer ? (
                        <input
                          type="text"
                          placeholder="Filtrar…"
                          value={filters[i] ?? ""}
                          onChange={(e) => setFilter(i, e.target.value)}
                          className="mt-1 w-full rounded border border-border-soft bg-white px-2 py-1 text-xs font-normal text-text-main outline-none focus:border-mkt-slate"
                        />
                      ) : null}
                      {column.filterable && hasServerColumnControls ? (
                        column.filterOptions && column.filterOptions.length > 0 ? (
                          <select
                            value={columnFilterInputs[column.key] ?? ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setColumnFilterInputs((prev) => ({
                                ...prev,
                                [column.key]: value,
                              }));
                              submitColumnFilter(column.key, value);
                            }}
                            aria-label={`Filtrar ${column.label}`}
                            className="mt-1 w-full rounded border border-border-soft bg-white px-2 py-1 text-xs font-normal text-text-main outline-none focus:border-mkt-slate"
                          >
                            {column.filterOptions.map((option) => (
                              <option key={option.value || "all"} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="Filtrar…"
                            value={columnFilterInputs[column.key] ?? ""}
                            onChange={(e) =>
                              setColumnFilterInputs((prev) => ({
                                ...prev,
                                [column.key]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                submitColumnFilter(column.key, columnFilterInputs[column.key] ?? "");
                              }
                            }}
                            onBlur={() =>
                              submitColumnFilter(column.key, columnFilterInputs[column.key] ?? "")
                            }
                            className="mt-1 w-full rounded border border-border-soft bg-white px-2 py-1 text-xs font-normal text-text-main outline-none focus:border-mkt-slate"
                          />
                        )
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paginatedIndices.length === 0 ? (
                <tr>
                  <td colSpan={tableHeaders.length} className="px-4 py-6 text-center text-sm text-text-muted">
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
              {mobileIndices.map((cellIdx) => (
                <div
                  key={cellIdx}
                  className="grid grid-cols-[minmax(5.5rem,38%)_1fr] gap-x-3 gap-y-1 border-b border-border-soft/60 py-2.5 text-sm last:border-0"
                >
                  <span className="text-xs font-medium text-text-muted">{tableHeaders[cellIdx]}</span>
                  <span className="min-w-0 text-text-main">{getCellNode(rows[idx][cellIdx])}</span>
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
