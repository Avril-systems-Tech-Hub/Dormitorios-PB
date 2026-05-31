import type { GuestPointsSummary } from "@/actions/guest-points";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

function formatPointsBalance(balance: string) {
  const value = Number(balance);
  if (Number.isNaN(value)) return balance;
  return new Intl.NumberFormat("es-MX").format(value);
}

export function GuestPointsCard({ points }: { points: GuestPointsSummary }) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text-main">Mis puntos</h2>
          <p className="mt-1 text-sm text-text-muted">
            Recompensas por hospedarte con nosotros. Canjeables pronto.
          </p>
        </div>
        {points.comingSoon ? (
          <Badge variant="warning">Próximamente</Badge>
        ) : null}
      </div>

      <div className="rounded-xl border border-border-soft bg-gradient-to-br from-brand-primary/5 via-surface-soft to-brand-accent/10 px-5 py-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {points.tokenName}
        </p>
        <p className="mt-2 text-4xl font-semibold tabular-nums text-text-main">
          {formatPointsBalance(points.balance)}
          <span className="ml-2 text-base font-medium text-text-muted">{points.tokenSymbol}</span>
        </p>
        {points.comingSoon ? (
          <p className="mt-3 text-sm text-text-muted">
            Estamos preparando tu programa de beneficios. Tus estadías futuras sumarán puntos
            automáticamente.
          </p>
        ) : null}
      </div>

      <ul className="grid gap-2 text-sm text-text-muted sm:grid-cols-3">
        <li className="rounded-lg border border-border-soft bg-surface-soft/50 px-3 py-2">
          <span className="block font-medium text-text-main">Reserva</span>
          Gana al reservar en línea
        </li>
        <li className="rounded-lg border border-border-soft bg-surface-soft/50 px-3 py-2">
          <span className="block font-medium text-text-main">Estadía</span>
          Bonificación por noche
        </li>
        <li className="rounded-lg border border-border-soft bg-surface-soft/50 px-3 py-2">
          <span className="block font-medium text-text-main">Canje</span>
          Descuentos y extras
        </li>
      </ul>
    </Card>
  );
}
