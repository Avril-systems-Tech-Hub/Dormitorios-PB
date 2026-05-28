import { registerPaymentAction } from "@/actions/operations";
import { Card } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireModulePermission } from "@/lib/auth/guards";
import { PaymentForm } from "@/components/forms/payment-form";
import { parsePagination, getRange, escapeIlike } from "@/lib/pagination";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModulePermission("payments");
  const params = await searchParams;
  const { page, pageSize, q } = parsePagination(params);
  const [from, to] = getRange(page, pageSize);

  const supabase = createAdminClient();

  // Folios para el dropdown del formulario (no paginado, sólo pendientes)
  const { data: folios } = await supabase
    .from("folios")
    .select("id,folio_code,total_amount,paid_amount,balance_due,payment_status")
    .neq("payment_status", "liquidated")
    .order("created_at", { ascending: false })
    .limit(100);

  let query = supabase
    .from("payments")
    .select("id,amount,method,payment_type,received_at,folios!inner(folio_code)", { count: "exact" });

  if (q) {
    query = query.ilike("folios.folio_code", `%${escapeIlike(q)}%`);
  }

  const { data: recentPayments, count } = await query
    .order("received_at", { ascending: false })
    .range(from, to);

  const rows =
    recentPayments?.map((payment) => {
      const folio = payment.folios as { folio_code?: string } | undefined;
      return [
        folio?.folio_code ?? "Sin folio",
        `$${Number(payment.amount).toFixed(2)}`,
        payment.method,
        payment.payment_type,
        new Date(payment.received_at).toLocaleString("es-MX"),
      ];
    }) ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold text-text-main">Cobro en caja</h2>
        <p className="mt-1 text-sm text-text-muted">
          El folio cambia a liquidado solo cuando el monto pagado cubre el total.
        </p>
        <PaymentForm action={registerPaymentAction} folios={folios ?? []} />
      </Card>
      <ResponsiveTable
        headers={["Folio", "Monto", "Método", "Tipo", "Fecha"]}
        rows={rows}
        filterMode="global"
        serverPagination={{
          page,
          pageSize,
          totalCount: count ?? 0,
          searchQuery: q,
          searchPlaceholder: "Buscar por folio…",
        }}
      />
    </div>
  );
}
