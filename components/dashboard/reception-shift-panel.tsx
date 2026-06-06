import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ShiftActionButtons } from "@/components/dashboard/shift-action-buttons";

type ReceptionShiftPanelProps = {
  returnTo?: string;
};

export async function ReceptionShiftPanel({ returnTo = "/dashboard" }: ReceptionShiftPanelProps) {
  const supabase = createAdminClient();
  const { data: openShift } = await supabase
    .from("shifts")
    .select("id, opened_at")
    .eq("status", "open")
    .maybeSingle();

  const hasOpenShift = Boolean(openShift);

  return (
    <Card className="border-brand-primary/30 bg-brand-primary/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-text-main sm:text-lg">Turno de recepción</h2>
            <Badge variant={hasOpenShift ? "warning" : "success"}>
              {hasOpenShift ? "Abierto" : "Cerrado"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {hasOpenShift
              ? `Turno activo desde ${new Date(openShift!.opened_at).toLocaleString("es-MX")}.`
              : "Inicia turno al comenzar operaciones en recepción."}
          </p>
        </div>
        <ShiftActionButtons hasOpenShift={hasOpenShift} returnTo={returnTo} />
      </div>
    </Card>
  );
}
