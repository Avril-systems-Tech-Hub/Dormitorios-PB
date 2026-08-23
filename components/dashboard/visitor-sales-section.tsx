import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { ft } from "@/components/ui/filterable-cell";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatRosterDateTime } from "@/lib/reception-guest-roster";
import { parsePagination, getRange } from "@/lib/pagination";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-insights";
import {
  listVisitorSalesForPeriod,
  VISITOR_CONCEPT_LABELS,
} from "@/lib/visitor-sales";
import { VisitorSaleDeleteButton } from "@/components/dashboard/visitor-sale-delete-button";
import type { TableColumnConfig } from "@/lib/table-controls";

const VISITOR_SALE_COLUMNS: TableColumnConfig[] = [
  { key: "cuando", label: "Fecha", sortable: false },
  { key: "nombre", label: "Nombre", sortable: false },
  { key: "concepto", label: "Concepto", sortable: false },
  { key: "numero", label: "Número", sortable: false },
  { key: "monto", label: "Monto", sortable: false },
  { key: "metodo", label: "Método", sortable: false },
  { key: "quien", label: "Cobró", sortable: false },
  { key: "notas", label: "Notas", sortable: false },
];

const VISITOR_SALE_ADMIN_COLUMNS: TableColumnConfig[] = [
  ...VISITOR_SALE_COLUMNS,
  { key: "eliminar", label: "" },
];

export async function VisitorSalesSection({
  startDate,
  endDate,
  periodLabel,
  searchParams,
  canDelete = false,
  embedded = false,
}: {
  startDate?: string | null;
  endDate?: string | null;
  periodLabel: string;
  searchParams: Record<string, string | string[] | undefined>;
  canDelete?: boolean;
  embedded?: boolean;
}) {
  const { page, pageSize } = parsePagination(searchParams, "visitor");
  const [from, to] = getRange(page, pageSize);
  const supabase = createAdminClient();
  const sales = await listVisitorSalesForPeriod(supabase, { startDate, endDate });
  const totalCount = sales.length;
  const showerCount = sales.filter((sale) => sale.concept === "shower").length;
  const lockerCount = sales.filter((sale) => sale.concept === "locker").length;
  const pagedSales = sales.slice(from, to + 1);

  const tableRows = pagedSales.map((row) => {
    const conceptLabel = VISITOR_CONCEPT_LABELS[row.concept];
    const cells = [
      ft(
        row.soldAt,
        <span className="whitespace-nowrap tabular-nums">{formatRosterDateTime(row.soldAt)}</span>,
      ),
      ft(row.visitorName ?? "Invitado", <span>{row.visitorName ?? "Invitado"}</span>),
      ft(
        conceptLabel,
        <Badge variant={row.concept === "shower" ? "warning" : "default"}>{conceptLabel}</Badge>,
      ),
      ft(row.resourceNumber, <span className="font-medium tabular-nums">{row.resourceNumber}</span>),
      ft(
        String(row.amount),
        <span className="tabular-nums">${row.amount.toFixed(2)}</span>,
      ),
      ft(PAYMENT_METHOD_LABELS[row.method], <span>{PAYMENT_METHOD_LABELS[row.method]}</span>),
      ft(row.soldByName ?? "", <span>{row.soldByName ?? "—"}</span>),
      ft(row.notes ?? "", <span className="text-text-muted">{row.notes ?? "—"}</span>),
    ];
    if (canDelete) {
      cells.push(
        ft(
          "eliminar",
          <VisitorSaleDeleteButton
            saleId={row.id}
            concept={row.concept}
            visitorName={row.visitorName}
            resourceNumber={row.resourceNumber}
            amount={row.amount}
          />,
        ),
      );
    }
    return cells;
  });

  const table = (
    <>
      <p className="text-sm text-text-muted">
        <span className="font-medium text-text-main">{totalCount}</span> cobro
        {totalCount === 1 ? "" : "s"}
        {totalCount > 0
          ? ` · ${showerCount} regadera${showerCount === 1 ? "" : "s"} · ${lockerCount} locker${lockerCount === 1 ? "" : "s"}`
          : ""}
        {embedded ? ` · ${periodLabel}` : ""}.
      </p>
      <div className={embedded ? "mt-4" : "mt-4 border-t border-border-soft pt-4"}>
        <ResponsiveTable
          columns={canDelete ? VISITOR_SALE_ADMIN_COLUMNS : VISITOR_SALE_COLUMNS}
          rows={tableRows}
          dense
          serverPagination={{
            page,
            pageSize,
            totalCount,
            paramPrefix: "visitor",
          }}
        />
      </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{table}</div>;
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-text-main">Invitados</h2>
      <p className="mt-1 text-sm text-text-muted">
        Personas que pagaron regadera o locker y se fueron, sin cama ni folio de estancia.
        Periodo: {periodLabel}.
      </p>
      <div className="mt-2">{table}</div>
    </Card>
  );
}
