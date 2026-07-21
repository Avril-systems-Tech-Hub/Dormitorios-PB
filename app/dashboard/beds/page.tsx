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

function groupBedsByBunk<
  T extends { bed_number: string },
>(beds: T[]): Array<{ bunkNumber: string; beds: T[] }> {
  const groups = new Map<string, T[]>();
  for (const bed of beds) {
    const match = String(bed.bed_number).match(/^(.*?)([a-c])$/i);
    const bunkNumber = match?.[1] || String(bed.bed_number);
    groups.set(bunkNumber, [...(groups.get(bunkNumber) ?? []), bed]);
  }
  return Array.from(groups.entries()).map(([bunkNumber, bunkBeds]) => ({
    bunkNumber,
    beds: bunkBeds.sort((a, b) =>
      String(a.bed_number).localeCompare(String(b.bed_number), "es-MX", {
        numeric: true,
      }),
    ),
  }));
}

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
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {groupBedsByBunk(beds).map((bunk) => (
          <div
            key={bunk.bunkNumber}
            className="rounded-2xl border border-border-soft bg-surface-soft/40 p-2 shadow-sm"
          >
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-text-muted">
              Litera {bunk.bunkNumber}
            </p>
            <div className="space-y-2">
              {bunk.beds.map((bed) => {
                const isBlocked = bed.status === "blocked";
                const detail = bedDetailMap.get(bed.id) ?? null;
                const isOccupied = detail?.in_house_today ?? false;
                const lockerLabel = detail
                  ? formatLockerLabel(detail.locker_number, detail.locker_days)
                  : null;
                const label =
                  formatBedLabel(bed.bed_number, bed.zone as BedZone) ?? bed.bed_number;

                return (
                  <div
                    key={bed.id}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      isBlocked
                        ? "border-slate-300 bg-slate-200/80"
                        : isOccupied
                          ? "border-red-300 bg-red-50"
                          : "border-emerald-300 bg-emerald-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-text-main">Cama {bed.bed_number}</p>
                      {isBlocked ? (
                        <Badge variant="danger">Bloqueada</Badge>
                      ) : isOccupied ? (
                        <Badge variant="warning">Ocupada</Badge>
                      ) : (
                        <Badge variant="success">Libre</Badge>
                      )}
                    </div>
                    {detail?.guest_name ? (
                      <p className="mt-1 truncate text-xs font-medium text-text-main">
                        {detail.guest_name}
                      </p>
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
          </div>
        ))}
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
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-border-soft bg-surface-soft/40 px-3 py-2 text-xs font-medium text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-emerald-400 bg-emerald-100" />
            Libre
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-red-400 bg-red-100" />
            Ocupada
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-slate-400 bg-slate-200" />
            Bloqueada
          </span>
        </div>
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
