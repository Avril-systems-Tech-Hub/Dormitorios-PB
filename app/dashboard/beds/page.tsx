import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth/guards";
import { buildBedOccupancyMap, matchesBedOccupancySearch } from "@/lib/bed-occupancy";
import { BED_TOTAL_COUNT, BED_ZONE_LABELS, formatBedLabel, groupBedsByZone } from "@/lib/beds";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BedCardAccordion } from "@/components/ui/bed-card-accordion";
import { BedStatusToggle } from "@/components/ui/bed-status-toggle";
import { FolioFilterInput } from "@/components/ui/folio-filter-input";
import { formatLockerLabel } from "@/components/ui/reservation-nights-cell";
import type { BedStatus, BedZone } from "@/types/domain";

function BedZoneSection({
  title,
  beds,
  bedDetailMap,
  canManageBedStatus,
}: {
  title: string;
  beds: Array<{ id: string; bed_number: string; zone: string; status: string }>;
  bedDetailMap: ReturnType<typeof buildBedOccupancyMap>;
  canManageBedStatus: boolean;
}) {
  if (beds.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {beds.map((bed) => {
          const isBlocked = bed.status === "blocked";
          const detail = bedDetailMap.get(bed.id) ?? null;
          const isOccupied = detail?.in_house_today ?? false;
          const lockerLabel = detail ? formatLockerLabel(detail.locker_number, detail.locker_days) : null;
          const label = formatBedLabel(bed.bed_number, bed.zone as BedZone) ?? bed.bed_number;

          return (
            <div
              key={bed.id}
              className="rounded-xl border border-border-soft bg-white px-3 py-2 text-sm"
            >
              <p className="font-semibold text-text-main">{label}</p>
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
              ) : (
                <Badge variant="success" className="mt-2">Libre</Badge>
              )}
              {canManageBedStatus ? (
                <BedStatusToggle
                  bedId={bed.id}
                  bedLabel={label}
                  status={bed.status as BedStatus}
                />
              ) : null}
              <BedCardAccordion detail={detail} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default async function BedsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; folio?: string }>;
}) {
  const params = await searchParams;
  const searchQuery = (params.q ?? params.folio)?.trim() ?? "";
  const profile = await getSessionProfile();
  const canManageBedStatus = profile.role === "admin" || profile.role === "reception";

  const admin = createAdminClient();

  const { data: beds } = await admin
    .from("beds")
    .select("id,bed_number,zone,status,sort_order")
    .order("sort_order", { ascending: true });

  const { data: rgRows } = await admin
    .from("reservation_guests")
    .select(
      `bed_id, reservation_id, guest_id, locker_number, locker_days,
      guests(full_name, phone, email),
      reservations!inner(
        id, status, checked_out_at, reservation_source, check_in_date, check_out_date, nights, notes, created_at,
        folios(folio_code, payment_status, total_amount, balance_due)
      )`,
    )
    .not("bed_id", "is", null);

  const bedDetailMap = buildBedOccupancyMap(rgRows ?? []);

  const filteredBeds = searchQuery
    ? (beds ?? []).filter((bed) => {
        const label = formatBedLabel(bed.bed_number, bed.zone) ?? "";
        if (label.toLowerCase().includes(searchQuery.toLowerCase())) return true;
        if (String(bed.bed_number).toLowerCase().includes(searchQuery.toLowerCase())) return true;
        return matchesBedOccupancySearch(bedDetailMap.get(bed.id), searchQuery);
      })
    : beds ?? [];

  const { mixta, mujeres } = groupBedsByZone(filteredBeds);
  const matchCount = searchQuery ? filteredBeds.length : 0;

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold text-text-main">Mapa de {BED_TOTAL_COUNT} camas</h2>
        <p className="mt-1 text-sm text-text-muted">
          Zona mixta (1a–15c) y zona solo mujeres (1a–7c). Ocupada = estancia vigente hoy con pago parcial o liquidado.
          {canManageBedStatus ? " Puedes bloquear o desbloquear camas en cada tarjeta." : null}
        </p>
        <div className="mt-3">
          <Suspense fallback={null}>
            <FolioFilterInput />
          </Suspense>
          {searchQuery && (
            <p className="mt-2 text-xs text-text-muted">
              Mostrando <span className="font-semibold text-text-main">{matchCount}</span> cama
              {matchCount !== 1 ? "s" : ""} para{" "}
              <span className="font-semibold text-text-main">{searchQuery}</span>
            </p>
          )}
        </div>
      </Card>

      <div className="space-y-6">
        <BedZoneSection
          title={BED_ZONE_LABELS.mixta}
          beds={mixta}
          bedDetailMap={bedDetailMap}
          canManageBedStatus={canManageBedStatus}
        />
        <BedZoneSection
          title={`Solo ${BED_ZONE_LABELS.mujeres.toLowerCase()}`}
          beds={mujeres}
          bedDetailMap={bedDetailMap}
          canManageBedStatus={canManageBedStatus}
        />
        {searchQuery && filteredBeds.length === 0 && (
          <p className="text-sm text-text-muted">
            No se encontraron camas para &quot;{searchQuery}&quot;.
          </p>
        )}
      </div>
    </div>
  );
}
