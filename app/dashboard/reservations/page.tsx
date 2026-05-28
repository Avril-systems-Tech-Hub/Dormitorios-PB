import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { ft } from "@/components/ui/filterable-cell";
import { ReservationGuestsAccordion } from "@/components/ui/reservation-guests-accordion";
import { ReservationPaymentInline } from "@/components/ui/reservation-payment-inline";
import { parsePagination, getRange, escapeIlike } from "@/lib/pagination";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { page, pageSize, q } = parsePagination(params);
  const [from, to] = getRange(page, pageSize);

  const supabase = createAdminClient();

  let query = supabase
    .from("reservations")
    .select(
      "id,created_at,status,reservation_source,check_in_date,check_out_date,nights,notes,profiles(full_name),folios!inner(id,folio_code,payment_status,balance_due,total_amount),reservation_guests(guest_id,guests(full_name,phone,email),beds(bed_number))",
      { count: "exact" },
    );

  if (q) {
    query = query.ilike("folios.folio_code", `%${escapeIlike(q)}%`);
  }

  const { data: reservations, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  const rows =
    reservations?.map((reservation) => {
      const allGuests = Array.isArray(reservation.reservation_guests) ? reservation.reservation_guests : [];
      const assignment = allGuests[0] ?? null;
      const guest = assignment?.guests as { full_name?: string; phone?: string } | undefined;
      const bed = assignment?.beds as { bed_number?: number } | undefined;
      const folio = reservation.folios as { id?: string; folio_code?: string; payment_status?: string; balance_due?: number; total_amount?: number } | undefined;

      const profile = reservation.profiles as { full_name?: string } | undefined;
      return [
        ft(
          folio?.folio_code ?? "Sin folio",
          <div key={`folio-${reservation.id}`}>
            <span>{folio?.folio_code ?? "Sin folio"}</span>
            <ReservationGuestsAccordion guests={allGuests} reservationId={reservation.id} />
          </div>,
        ),
        guest?.full_name ?? "Sin huésped",
        guest?.phone ?? "-",
        bed?.bed_number ? `Cama ${bed.bed_number}` : "Pendiente",
        `${reservation.check_in_date} -> ${reservation.check_out_date}`,
        `${reservation.nights} noche(s)`,
        reservation.created_at
          ? new Date(reservation.created_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
          : "—",
        ft(
          reservation.reservation_source === "cashier_counter" ? "Caja" : "App cliente",
          reservation.reservation_source === "cashier_counter" ? (
            <Badge key={`${reservation.id}-src`} variant="warning">Caja ({profile?.full_name ?? "sin usuario"})</Badge>
          ) : (
            <Badge key={`${reservation.id}-src`} variant="success">App cliente</Badge>
          ),
        ),
        ft(
          folio?.payment_status ?? "pending",
          <Badge key={`${reservation.id}-pay`} variant={folio?.payment_status === "liquidated" ? "success" : "warning"}>
            {folio?.payment_status ?? "pending"}
          </Badge>,
        ),
        folio?.total_amount ? `$${Number(folio.total_amount).toFixed(2)}` : "$0.00",
        folio?.balance_due ? `$${Number(folio.balance_due).toFixed(2)}` : "$0.00",
        folio?.id ? (
          <ReservationPaymentInline
            key={`pay-${reservation.id}`}
            folioId={folio.id}
            folioCode={folio.folio_code ?? ""}
            balanceDue={Number(folio.balance_due ?? 0)}
            totalAmount={Number(folio.total_amount ?? 0)}
            paymentStatus={folio.payment_status ?? "pending"}
            returnTo="/dashboard/reservations"
          />
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
      ];
    }) ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold text-text-main">Reservaciones activas</h2>
        <p className="mt-1 text-sm text-text-muted">
          Control de check-in, cama asignada y estado de pago por folio.
        </p>
      </Card>
      <ResponsiveTable
        headers={["Folio", "Huésped", "Teléfono", "Cama", "Fechas", "Noches", "Creada", "Origen", "Pago", "Total", "Saldo", "Cobrar"]}
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
