import type { ReactNode } from "react";

export function ResponsiveTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-soft bg-white shadow-sm">
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-soft text-left text-text-muted">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-t border-border-soft">
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="px-4 py-3 text-text-main">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 p-3 md:hidden">
        {rows.map((row, idx) => (
          <div key={idx} className="rounded-lg border border-border-soft p-3">
            {row.map((cell, cellIdx) => (
              <div key={cellIdx} className="flex justify-between gap-2 py-1 text-sm">
                <span className="text-text-muted">{headers[cellIdx]}</span>
                <span className="text-right text-text-main">{cell}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
