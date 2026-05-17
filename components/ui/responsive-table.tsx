"use client";

import { useState, useMemo, useCallback, type ReactNode } from "react";
import type { FilterableCell } from "@/components/ui/filterable-cell";

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

export function ResponsiveTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: FilterableCell[][];
}) {
  const [filters, setFilters] = useState<Record<number, string>>({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Build text representation for filtering
  const textRows = useMemo(
    () => rows.map((row) => row.map(getCellText)),
    [rows],
  );

  const filteredIndices = useMemo(() => {
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
  }, [rows, textRows, filters]);

  const totalFiltered = filteredIndices.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  const paginatedIndices = useMemo(
    () => filteredIndices.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [filteredIndices, safePage, pageSize],
  );

  const setFilter = useCallback((colIdx: number, value: string) => {
    setFilters((prev) => ({ ...prev, [colIdx]: value }));
    setPage(0);
  }, []);

  const handlePageSize = useCallback((size: number) => {
    setPageSize(size);
    setPage(0);
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-border-soft bg-white shadow-sm">
      {/* Toolbar: pageSize selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft bg-gray-50/50 px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>Mostrar</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSize(Number(e.target.value))}
            className="rounded-md border border-border-soft bg-white px-2 py-1 text-sm text-text-main"
          >
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>registros</span>
        </div>
        <span className="text-xs text-text-muted">
          {totalFiltered} resultado{totalFiltered !== 1 ? "s" : ""}
          {totalFiltered !== rows.length && ` (de ${rows.length} total)`}
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-soft text-left text-text-muted">
              <tr>
                {headers.map((header, i) => (
                  <th key={header} className="px-4 py-3 font-medium">
                    <div>{header}</div>
                    <input
                      type="text"
                      placeholder={`Filtrar...`}
                      value={filters[i] ?? ""}
                      onChange={(e) => setFilter(i, e.target.value)}
                      className="mt-1 w-full rounded border border-border-soft bg-white px-2 py-1 text-xs font-normal text-text-main outline-none focus:border-mkt-slate"
                    />
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
                  <tr key={idx} className="border-t border-border-soft">
                    {rows[idx].map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-3 text-text-main">
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

      {/* Mobile cards */}
      <div className="space-y-3 p-3 md:hidden">
        {paginatedIndices.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-muted">Sin resultados</p>
        ) : (
          paginatedIndices.map((idx) => (
            <div key={idx} className="rounded-lg border border-border-soft p-3">
              {rows[idx].map((cell, cellIdx) => (
                <div key={cellIdx} className="flex justify-between gap-2 py-1 text-sm">
                  <span className="text-text-muted">{headers[cellIdx]}</span>
                  <span className="text-right text-text-main">{getCellNode(cell)}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft bg-gray-50/50 px-4 py-2">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage(Math.max(0, safePage - 1))}
            className="rounded-md border border-border-soft bg-white px-3 py-1 text-xs font-medium text-text-main transition hover:bg-gray-50 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => {
              if (totalPages > 7) {
                if (i === 0 || i === totalPages - 1 || (i >= safePage - 1 && i <= safePage + 1)) {
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPage(i)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        i === safePage
                          ? "bg-mkt-slate text-white"
                          : "border border-border-soft bg-white text-text-main hover:bg-gray-50"
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                }
                if (i === safePage - 2 || i === safePage + 2) {
                  return (
                    <span key={i} className="px-1 text-xs text-text-muted">…</span>
                  );
                }
                return null;
              }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    i === safePage
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
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
            className="rounded-md border border-border-soft bg-white px-3 py-1 text-xs font-medium text-text-main transition hover:bg-gray-50 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}