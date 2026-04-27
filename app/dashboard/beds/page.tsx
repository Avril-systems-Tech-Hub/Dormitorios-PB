import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function BedsPage() {
  const supabase = await createClient();
  const { data: beds } = await supabase
    .from("beds")
    .select("id,bed_number,status")
    .order("bed_number", { ascending: true })
    .limit(60);

  const { data: occupiedRows } = await supabase
    .from("reservation_guests")
    .select("bed_id,reservations!inner(status)")
    .in(
      "reservation_id",
      (
        await supabase
          .from("reservations")
          .select("id")
          .in("status", ["active", "confirmed"])
      ).data?.map((r) => r.id) ?? [],
    );

  const occupiedSet = new Set((occupiedRows ?? []).map((row) => row.bed_id));

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold text-text-main">Mapa de 60 camas</h2>
        <p className="mt-1 text-sm text-text-muted">
          Disponible, ocupada o bloqueada. La asignación puede ser manual o autoasignada en la reserva.
        </p>
      </Card>
      <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {(beds ?? []).map((bed) => {
          const isBlocked = bed.status === "blocked";
          const isOccupied = occupiedSet.has(bed.id);
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
