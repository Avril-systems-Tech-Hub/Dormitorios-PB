import { NIGHTLY_PRICE_MXN } from "./constants";

export function PriceBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative inline-flex flex-col items-center rounded-2xl border-2 border-mkt-terracotta bg-mkt-sky px-6 py-4 text-center shadow-sm ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-mkt-ink">Cama por noche</p>
      <p className="mt-1 font-semibold tracking-tight text-mkt-ink">
        <span className="text-mkt-terracotta text-3xl md:text-4xl">{`$${NIGHTLY_PRICE_MXN}`}</span>
        <span className="text-lg text-mkt-ink-muted"> MXN</span>
      </p>
    </div>
  );
}
