import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth/guards";
import { buildBedOccupancyMap } from "@/lib/bed-occupancy";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BedCardAccordion } from "@/components/ui/bed-card-accordion";
import { BedStatusToggle } from "@/components/ui/bed-status-toggle";
import { FolioFilterInput } from "@/components/ui/folio-filter-input";
import { formatLockerLabel } from "@/components/ui/reservation-nights-cell";
import type { BedStatus } from "@/types/domain";

export default async function BedsPage({
  searchParams,
}: {
  searchParams: Promise<{ folio?: string }>;
}) {
  const params = await searchParams;
  const folioFilter = params.folio?.trim() ?? "";
  const profile = await getSessionProfile();
  const isAdmin = profile.role === "admin";

  const admin = createAdminClient();

  const { data: beds } = await admin
    .from("beds")
    .select("id,bed_number,status")
    .order("bed_number", { ascending: true })
    .limit(60);

  const { data: rgRows } = await admin
    .from("reservation_guests")
    .select(
      `bed_id, reservation_id, guest_id, locker_number, locker_days,
      guests(full_name, phone, email),
      reservations!inner(
        id, status, reservation_source, check_in_date, check_out_date, nights, notes, created_at,
        folios(folio_code, payment_status, total_amount, balance_due)
      )`,
    )
    .not("bed_id", "is", null);

  const bedDetailMap = buildBedOccupancyMap(rgRows ?? []);

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
          Misma asignación que en Reservas (folio, huésped, locker). Ocupada = en casa hoy; Asignada = reserva activa en sistema.
          {isAdmin ? " Como admin puedes bloquear o desbloquear camas en cada tarjeta." : null}
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
          const isOccupied = detail?.in_house_today ?? false;
          const hasAssignment = !!detail;
          const lockerLabel = detail ? formatLockerLabel(detail.locker_number, detail.locker_days) : null;

          return (
            <div
              key={bed.id}
              className="rounded-xl border border-border-soft bg-white px-3 py-2 text-sm"
            >
              <p className="font-semibold text-text-main">Cama {bed.bed_number}</p>
              {detail?.guest_name ? (
                <p className="mt-0.5 truncate text-xs font-medium text-text-main">{detail.guest_name}</p>
              ) : null}
              {detail?.folio_code ? (
                <p className="text-xs text-text-muted">{detail.folio_code}</p>
              ) : null}
              {lockerLabel ? (
                <p
                  className={
                    lockerLabel === "Locker pendiente"
                      ? "mt-0.5 text-xs font-medium text-amber-700"
                      : "mt-0.5 text-xs text-text-muted"
                  }
                >
                  {lockerLabel}
                </p>
              ) : null}
              {isBlocked ? (
                <Badge variant="danger" className="mt-2">Bloqueada</Badge>
              ) : isOccupied ? (
                <Badge variant="warning" className="mt-2">Ocupada</Badge>
              ) : hasAssignment ? (
                <Badge variant="warning" className="mt-2 opacity-80">Asignada</Badge>
              ) : (
                <Badge variant="success" className="mt-2">Libre</Badge>
              )}
              {isAdmin ? (
                <BedStatusToggle
                  bedId={bed.id}
                  bedNumber={bed.bed_number}
                  status={bed.status as BedStatus}
                />
              ) : null}
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
