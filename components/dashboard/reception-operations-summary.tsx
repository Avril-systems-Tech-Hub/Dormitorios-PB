import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildBedOccupancyMap } from "@/lib/bed-occupancy";
import { computeBedSummaryCounts } from "@/lib/bed-summary";
import { getMexicoCityDateString } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type StatCardProps = {
  label: string;
  value: number;
  hint?: string;
  badge?: { text: string; variant: "success" | "warning" | "danger" };
  href: string;
};

function StatCard({ label, value, hint, badge, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-xl transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
    >
      <Card className="h-full transition hover:border-brand-primary/40 hover:bg-surface-soft/40">
        <p className="text-sm text-text-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-text-muted">{hint}</p> : null}
        {badge ? (
          <Badge variant={badge.variant} className="mt-2">
            {badge.text}
          </Badge>
        ) : null}
      </Card>
    </Link>
  );
}

export async function ReceptionOperationsSummary() {
  const supabase = createAdminClient();
  const today = getMexicoCityDateString();

  const [
    { count: activeReservations },
    { count: unpaidFolios },
    { count: guestsWithoutBed },
    { count: pendingLockerGuests },
    { data: beds },
    { data: rgRows },
  ] = await Promise.all([
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .neq("status", "cancelled"),
    supabase
      .from("folios")
      .select("id", { count: "exact", head: true })
      .neq("payment_status", "liquidated"),
    supabase
      .from("reservation_guests")
      .select("id, reservations!inner(status)", { count: "exact", head: true })
      .is("bed_id", null)
      .neq("reservations.status", "cancelled"),
    supabase
      .from("reservation_guests")
      .select("id, reservations!inner(status)", { count: "exact", head: true })
      .gt("locker_days", 0)
      .is("locker_number", null)
      .neq("reservations.status", "cancelled"),
    supabase.from("beds").select("id, status"),
    supabase
      .from("reservation_guests")
      .select(
        `bed_id, reservation_id, guest_id, locker_number, locker_days,
        reservations!inner(id, status, check_in_date, check_out_date)`,
      )
      .not("bed_id", "is", null),
  ]);

  const bedOccupancyMap = buildBedOccupancyMap(rgRows ?? [], today);
  const bedCounts = computeBedSummaryCounts(beds ?? [], bedOccupancyMap);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Reservas activas"
          value={activeReservations ?? 0}
          href="/dashboard/reservations"
        />
        <StatCard
          label="Por cobrar"
          value={unpaidFolios ?? 0}
          hint="Folios con saldo pendiente"
          badge={
            (unpaidFolios ?? 0) > 0
              ? { text: "Revisar cobros", variant: "warning" }
              : { text: "Al día", variant: "success" }
          }
          href="/dashboard/reservations"
        />
        <StatCard
          label="Sin cama"
          value={guestsWithoutBed ?? 0}
          hint="Huéspedes pendientes de asignación"
          badge={
            (guestsWithoutBed ?? 0) > 0
              ? { text: "Asignar en Reservas", variant: "warning" }
              : undefined
          }
          href="/dashboard/reservations"
        />
        <StatCard
          label="Locker pendiente"
          value={pendingLockerGuests ?? 0}
          hint="Servicio sin número físico"
          href="/dashboard/reservations"
        />
        <StatCard
          label="Camas libres hoy"
          value={bedCounts.libres}
          hint={`${bedCounts.inventario} en inventario`}
          href="/dashboard/beds"
        />
      </div>

      <Card className="border-brand-primary/25 bg-brand-primary/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text-main sm:text-lg">Operación del turno</h2>
            <p className="mt-1 text-sm text-text-muted">
              Asigna camas y lockers, registra cobros y consulta el detalle en{" "}
              <span className="font-medium text-text-main">Reservas</span>. Este resumen solo muestra
              pendientes; el trabajo diario se hace ahí.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Link
              href="/dashboard/reservations"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-primary/90"
            >
              Ir a Reservas
            </Link>
            <Link
              href="/dashboard/beds"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border-soft bg-white px-4 text-sm font-medium text-text-main transition hover:bg-surface-soft"
            >
              Mapa de camas
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
