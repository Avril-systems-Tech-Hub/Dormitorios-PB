"use client";

import {
  RECENT_RESERVATION_LIMIT_OPTIONS,
  type RecentReservationLimit,
  type ReceptionSearchResult,
} from "@/lib/reception-check-in";

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatCreatedAt(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReservationStatusBadges({ result }: { result: ReceptionSearchResult }) {
  const badges: { label: string; className: string }[] = [];

  if (result.balanceDue > 0) {
    badges.push({
      label: "Por cobrar",
      className: "bg-amber-100 text-amber-900",
    });
  } else if (result.paymentStatus === "liquidated") {
    badges.push({
      label: "Pagado",
      className: "bg-green-100 text-green-800",
    });
  }

  if (!result.allBedsAssigned) {
    badges.push({
      label: "Sin cama",
      className: "bg-red-100 text-red-800",
    });
  }

  if (!result.allLockersAssigned) {
    badges.push({
      label: "Sin locker",
      className: "bg-orange-100 text-orange-900",
    });
  }

  if (badges.length === 0) {
    badges.push({
      label: "Listo",
      className: "bg-surface-soft text-text-muted",
    });
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium sm:text-xs ${badge.className}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

export function ReceptionReservationListItem({
  result,
  onSelect,
  showCreatedAt = false,
}: {
  result: ReceptionSearchResult;
  onSelect: (result: ReceptionSearchResult) => void;
  showCreatedAt?: boolean;
}) {
  const createdLabel = showCreatedAt ? formatCreatedAt(result.createdAt) : null;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(result)}
        className="w-full rounded-xl border border-border-soft bg-white px-4 py-3 text-left transition hover:border-brand-primary/40 hover:bg-brand-primary/5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text-main">{result.folioCode}</p>
            <p className="text-sm text-text-muted">
              {result.guests.map((g) => g.fullName).join(", ")}
            </p>
            <p className="text-xs text-text-muted">
              {result.checkInDate} → {result.checkOutDate} · {result.nights} noche(s)
            </p>
            {createdLabel ? (
              <p className="mt-0.5 text-xs text-text-muted">Registrada {createdLabel}</p>
            ) : null}
            <ReservationStatusBadges result={result} />
          </div>
          <div className="shrink-0 text-right">
            <p
              className={`text-lg font-semibold tabular-nums ${
                result.balanceDue > 0 ? "text-brand-primary" : "text-text-muted"
              }`}
            >
              {formatMoney(result.balanceDue)}
            </p>
            <p className="text-xs text-text-muted">
              {result.balanceDue > 0 ? "por cobrar" : "sin saldo"}
            </p>
          </div>
        </div>
      </button>
    </li>
  );
}

export function ReceptionReservationList({
  results,
  onSelect,
  showCreatedAt = false,
  emptyMessage,
}: {
  results: ReceptionSearchResult[];
  onSelect: (result: ReceptionSearchResult) => void;
  showCreatedAt?: boolean;
  emptyMessage: string;
}) {
  if (results.length === 0) {
    return <p className="text-sm text-text-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-2">
      {results.map((result) => (
        <ReceptionReservationListItem
          key={result.reservationId}
          result={result}
          onSelect={onSelect}
          showCreatedAt={showCreatedAt}
        />
      ))}
    </ul>
  );
}

type SearchMode = "search" | "recent";

export function ReceptionSearchModeToggle({
  mode,
  onChange,
}: {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-border-soft bg-surface-soft/60 p-1">
      <button
        type="button"
        onClick={() => onChange("search")}
        className={`rounded-md px-3 py-2 text-sm font-medium transition ${
          mode === "search"
            ? "bg-white text-text-main shadow-sm"
            : "text-text-muted hover:text-text-main"
        }`}
      >
        Buscar
      </button>
      <button
        type="button"
        onClick={() => onChange("recent")}
        className={`rounded-md px-3 py-2 text-sm font-medium transition ${
          mode === "recent"
            ? "bg-white text-text-main shadow-sm"
            : "text-text-muted hover:text-text-main"
        }`}
      >
        Recientes
      </button>
    </div>
  );
}

export type { SearchMode as ReceptionSearchMode };

export function ReceptionRecentLimitFilter({
  value,
  onChange,
  disabled,
}: {
  value: RecentReservationLimit;
  onChange: (limit: RecentReservationLimit) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-border-soft bg-surface-soft/60 p-1"
      role="group"
      aria-label="Cantidad de reservaciones recientes"
    >
      {RECENT_RESERVATION_LIMIT_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          className={`min-w-[2.5rem] rounded-md px-3 py-1.5 text-sm font-medium transition ${
            value === option
              ? "bg-white text-text-main shadow-sm"
              : "text-text-muted hover:text-text-main disabled:opacity-50"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
