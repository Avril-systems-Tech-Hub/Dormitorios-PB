import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { addFolioExtraServiceAction, sendWhatsAppTicketAction } from "@/actions/operations";
import { createClient } from "@/lib/supabase/server";

export default async function FoliosPage() {
  const supabase = await createClient();
  const { data: folios } = await supabase
    .from("folios")
    .select("id,folio_code,total_amount,paid_amount,balance_due,payment_status,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows =
    folios?.map((folio) => [
      folio.folio_code,
      `$${Number(folio.total_amount).toFixed(2)}`,
      `$${Number(folio.paid_amount).toFixed(2)}`,
      `$${Number(folio.balance_due).toFixed(2)}`,
      <Badge key={`${folio.id}-status`} variant={folio.payment_status === "liquidated" ? "success" : "warning"}>
        {folio.payment_status}
      </Badge>,
      <form key={`${folio.id}-wa`} action={sendWhatsAppTicketAction}>
        <input type="hidden" name="folio_id" value={folio.id} />
        <input type="hidden" name="return_to" value="/dashboard/folios" />
        <Button type="submit" variant="outline" className="h-8 px-3 text-xs">
          Enviar ticket WhatsApp
        </Button>
      </form>,
    ]) ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold text-text-main">Folios y tickets</h2>
        <p className="mt-1 text-sm text-text-muted">
          Cada reserva genera folio único. Solo se confirma cuando el saldo llega a cero.
        </p>
        <form action={addFolioExtraServiceAction} className="mt-4 grid gap-2 md:grid-cols-5">
          <select name="folio_id" className="h-10 rounded border border-border-soft px-3 text-sm md:col-span-2" required>
            <option value="">Selecciona folio</option>
            {(folios ?? []).map((folio) => (
              <option key={folio.id} value={folio.id}>
                {folio.folio_code} | Saldo {Number(folio.balance_due).toFixed(2)}
              </option>
            ))}
          </select>
          <input name="service_name" placeholder="Servicio extra (ej. Carga celular)" className="h-10 rounded border border-border-soft px-3 text-sm" required />
          <input name="amount" type="number" step="0.01" min="0" placeholder="Monto" className="h-10 rounded border border-border-soft px-3 text-sm" required />
          <Button type="submit" variant="outline">Agregar extra</Button>
          <input name="notes" placeholder="Notas" className="h-10 rounded border border-border-soft px-3 text-sm md:col-span-5" />
          <input type="hidden" name="return_to" value="/dashboard/folios" />
        </form>
      </Card>
      <ResponsiveTable
        headers={["Folio", "Total", "Pagado", "Saldo", "Estatus", "Ticket"]}
        rows={rows}
      />
    </div>
  );
}
