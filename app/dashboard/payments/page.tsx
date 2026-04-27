import { registerPaymentAction } from "@/actions/operations";
import { Card } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { createClient } from "@/lib/supabase/server";
import { PaymentForm } from "@/components/forms/payment-form";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const { data: folios } = await supabase
    .from("folios")
    .select("id,folio_code,total_amount,paid_amount,balance_due,payment_status")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: recentPayments } = await supabase
    .from("payments")
    .select("id,amount,method,payment_type,received_at,folios(folio_code)")
    .order("received_at", { ascending: false })
    .limit(20);

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
      <ResponsiveTable headers={["Folio", "Monto", "Método", "Tipo", "Fecha"]} rows={rows} />
    </div>
  );
}
