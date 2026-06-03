"use client";

import { useState } from "react";

type AuditTechnicalDetailProps = {
  action: string;
  entityType: string;
  metadataJson: string;
};

export function AuditTechnicalDetail({
  action,
  entityType,
  metadataJson,
}: AuditTechnicalDetailProps) {
  const [open, setOpen] = useState(false);
  const hasMetadata = metadataJson !== "{}" && metadataJson.length > 2;

  if (!hasMetadata) {
    return <span className="text-xs text-text-muted">—</span>;
  }

  return (
    <div className="text-left">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="text-xs font-medium text-brand-primary underline-offset-2 hover:underline"
        aria-expanded={open}
      >
        {open ? "Ocultar datos técnicos" : "Ver datos técnicos"}
      </button>
      {open ? (
        <div className="mt-2 rounded-lg border border-border-soft bg-surface-soft/60 p-2 text-xs text-text-muted">
          <p>
            <span className="font-medium text-text-main">Acción:</span> {action}
          </p>
          <p className="mt-1">
            <span className="font-medium text-text-main">Tipo:</span> {entityType}
          </p>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px]">
            {metadataJson}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
