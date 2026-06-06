"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";

type ReceptionGuestRosterPanelProps = {
  defaultExpanded?: boolean;
  children: ReactNode;
};

export function ReceptionGuestRosterPanel({
  defaultExpanded = false,
  children,
}: ReceptionGuestRosterPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-main sm:text-lg">Listado de huéspedes</h2>
          <p className="text-sm text-text-muted">
            Tabla completa con día, folio, cama, locker, fechas y total por persona.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="w-full shrink-0 rounded-lg border border-border-soft bg-surface-soft px-3 py-2 text-sm font-medium text-text-main sm:w-auto sm:py-1.5"
          aria-expanded={expanded}
        >
          {expanded ? "Ocultar listado" : "Ver listado"}
        </button>
      </div>

      {expanded ? <div className="mt-4 border-t border-border-soft pt-4">{children}</div> : null}
    </Card>
  );
}
