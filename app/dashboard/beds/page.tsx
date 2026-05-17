import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BedCardAccordion } from "@/components/ui/bed-card-accordion";
import { FolioFilterInput } from "@/components/ui/folio-filter-input";

export default async function BedsPage({
  searchParams,
}: {
  searchParams: Promise<{ folio?: string }>;
}) {
  const params = await searchParams;
  const folioFilter = params.folio?.trim() ?? "";

  const admin = createAdminClient();

  // 1. Get all beds
  const { data: beds } = await admin
    .from("beds")
    .select("id,bed_number,status")
    .order("bed_number", { ascending: true })
    .limit(60);

  // 2. Get all reservation_guests with bed assigned
  const { data: rgRows } = await admin
    .from("reservation_guests")
    .select("bed_id, reservation_id, guest_id")
    .not("bed_id", "is", null);

  // 3. Get reservation details (include folio_id)
  const reservationIds = [...new Set((rgRows ?? []).map((r) => r.reservation_id))];
  const { data: reservations } = await admin
    .from("reservations")
    .select("id,folio_id,status,reservation_source,check_in_date,check_out_date,nights,notes,created_at")
    .in("id", reservationIds.length > 0 ? reservationIds : ["00000000-0000-0000-0000-000000000000"]);

  // 4. Get guest details
  const guestIds = [...new Set((rgRows ?? []).map((r) => r.guest_id))];
  const { data: guestsData } = await admin
    .from("guests")
    .select("id,full_name,phone,email")
    .in("id", guestIds.length > 0 ? guestIds : ["00000000-0000-0000-0000-000000000000"]);

  // 5. Get folios
  const folioIds = [...new Set((reservations ?? []).map((r) => r.folio_id).filter(Boolean))];
  const { data: foliosData } = await admin
    .from("folios")
    .select("id,folio_code,payment_status,total_amount,balance_due")
    .in("id", folioIds.length > 0 ? folioIds : ["00000000-0000-0000-0000-000000000000"]);

  // Build lookup maps
  const reservationMap = new Map((reservations ?? []).map((r) => [r.id, r]));
  const guestMap = new Map((guestsData ?? []).map((g) => [g.id, g]));
  const folioMap = new Map((foliosData ?? []).map((f) => [f.id, f]));

  // Build bed detail map
  const bedDetailMap = new Map<string, {
    guest_name?: string;
    guest_phone?: string;
    guest_email?: string;
    folio_code?: string;
    check_in?: string;
    check_out?: string;
    nights?: number;
    source?: string;
    created_at?: string;
    payment_status?: string;
    total_amount?: number;
    balance_due?: number;
    notes?: string;
  }>();

  for (const rg of rgRows ?? []) {
    if (!rg.bed_id) continue;

    const reservation = reservationMap.get(rg.reservation_id);
    const guest = guestMap.get(rg.guest_id);
    const folio = reservation?.folio_id ? folioMap.get(reservation.folio_id) : null;

    if (bedDetailMap.has(rg.bed_id)) continue;

    bedDetailMap.set(rg.bed_id, {
      guest_name: guest?.full_name ?? undefined,
      guest_phone: guest?.phone ?? undefined,
      guest_email: guest?.email ?? undefined,
      folio_code: folio?.folio_code ?? undefined,
      check_in: reservation?.check_in_date ?? undefined,
      check_out: reservation?.check_out_date ?? undefined,
      nights: reservation?.nights ?? undefined,
      source: reservation?.reservation_source ?? undefined,
      created_at: reservation?.created_at ?? undefined,
      payment_status: folio?.payment_status ?? undefined,
      total_amount: folio?.total_amount ?? undefined,
      balance_due: folio?.balance_due ?? undefined,
      notes: reservation?.notes ?? undefined,
    });
  }

  // Filter beds by folio if filter is active
  const filteredBeds = folioFilter
    ? (beds ?? []).filter((bed) => {
        const detail = bedDetailMap.get(bed.id);
        if (!detail?.folio_code) return false;
        return detail.folio_code.toLowerCase().includes(folioFilter.toLowerCase());
      })
    : beds ?? [];

  const matchCount = folioFilter ? filteredBeds.length : 0;

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold text-text-main">Mapa de 60 camas</h2>
        <p className="mt-1 text-sm text-text-muted">
          Disponible, ocupada o bloqueada. Haz clic en "Ver detalle" para ver la reservación y huésped asignados.
        </p>
        <div className="mt-3">
          <Suspense fallback={null}>
            <FolioFilterInput />
          </Suspense>
          {folioFilter && (
            <p className="mt-2 text-xs text-text-muted">
              Mostrando <span className="font-semibold text-text-main">{matchCount}</span> cama{matchCount !== 1 ? "s" : ""} del folio <span className="font-semibold text-text-main">{folioFilter}</span>
            </p>
          )}
        </div>
      </Card>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {filteredBeds.map((bed) => {
          const isBlocked = bed.status === "blocked";
          const detail = bedDetailMap.get(bed.id) ?? null;
          const isOccupied = !!detail;

          return (
            <div
              key={bed.id}
              className="rounded-xl border border-border-soft bg-white px-3 py-2 text-sm"
            >
              <p className="font-semibold text-text-main">Cama {bed.bed_number}</p>
              {isBlocked ? (
                <Badge variant="danger" className="mt-2">Bloqueada</Badge>
              ) : isOccupied ? (
                <Badge variant="warning" className="mt-2">Ocupada</Badge>
              ) : (
                <Badge variant="success" className="mt-2">Libre</Badge>
              )}
              <BedCardAccordion detail={detail} />
            </div>
          );
        })}
        {folioFilter && filteredBeds.length === 0 && (
          <p className="col-span-full text-sm text-text-muted">No se encontraron camas para el folio "{folioFilter}".</p>
        )}
      </div>
    </div>
  );
}