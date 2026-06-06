import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShiftActionButtons } from "@/components/dashboard/shift-action-buttons";

export function ReceptionShiftGate() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center py-6">
      <Card className="w-full border-brand-primary/30 bg-brand-primary/5 p-6 sm:p-8 lg:p-10">
        <div className="text-center">
          <Badge variant="success" className="mb-4">
            Recepción
          </Badge>
          <h1 className="text-xl font-semibold text-text-main sm:text-2xl">
            Inicia tu turno para atender huéspedes
          </h1>
          <p className="mt-3 text-sm text-text-muted">
            El turno solo termina al presionar <span className="font-medium text-text-main">Terminar turno</span>.
            Cerrar la app o salir no cierra el turno.
          </p>
        </div>
        <div className="mt-8">
          <ShiftActionButtons hasOpenShift={false} returnTo="/dashboard" />
        </div>
      </Card>
    </div>
  );
}
