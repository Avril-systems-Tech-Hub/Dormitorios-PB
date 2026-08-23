import { getExpenseConceptLabel } from "@/lib/expense-concepts";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-insights";
import { formatBedLabel } from "@/lib/beds";

export type AuditCategory =
  | "all"
  | "reservations"
  | "payments"
  | "cash"
  | "beds"
  | "import"
  | "messages";

export const AUDIT_CATEGORY_FILTERS: {
  value: AuditCategory;
  toggleLabel: string;
  actions: string[] | null;
}[] = [
  { value: "all", toggleLabel: "Todo", actions: null },
  {
    value: "reservations",
    toggleLabel: "Reservas",
    actions: ["reservation_created", "bed_reassigned"],
  },
  {
    value: "payments",
    toggleLabel: "Pagos",
    actions: ["payment_registered", "payment_reversed", "payment_receipt_resent", "folio_extra_service_added", "visitor_sale_registered", "visitor_sale_deleted"],
  },
  {
    value: "cash",
    toggleLabel: "Caja y gastos",
    actions: ["expense_created", "expense_updated", "cash_movement_created", "daily_cash_cut_generated", "service_prices_updated"],
  },
  {
    value: "beds",
    toggleLabel: "Camas y lockers",
    actions: ["bed_status_updated", "locker_assigned"],
  },
  {
    value: "import",
    toggleLabel: "Importación",
    actions: [
      "import_preview_created",
      "import_batch_committed",
      "import_record_recalculated",
      "import_record_updated",
    ],
  },
  {
    value: "messages",
    toggleLabel: "Mensajes",
    actions: ["whatsapp_ticket_sent"],
  },
];

const ACTION_LABELS: Record<string, string> = {
  reservation_created: "Nueva reservación",
  payment_registered: "Pago registrado",
  payment_reversed: "Pago corregido",
  cash_movement_created: "Movimiento de caja",
  expense_created: "Gasto operativo",
  expense_updated: "Gasto editado",
  daily_cash_cut_generated: "Corte de caja",
  whatsapp_ticket_sent: "Ticket por WhatsApp",
  import_preview_created: "Vista previa de importación",
  import_batch_committed: "Importación confirmada",
  payment_receipt_resent: "Comprobante reenviado",
  bed_reassigned: "Cambio de cama",
  bed_status_updated: "Cama actualizada",
  locker_assigned: "Locker asignado",
  import_record_recalculated: "Registro histórico recalculado",
  import_record_updated: "Registro histórico editado",
  folio_extra_service_added: "Servicio extra agregado",
  visitor_sale_registered: "Cobro de invitado",
  visitor_sale_deleted: "Cobro de invitado eliminado",
  service_prices_updated: "Precios actualizados",
};

const ENTITY_LABELS: Record<string, string> = {
  reservation: "Reservación",
  folio: "Folio",
  cash_movement: "Caja",
  cash_cut: "Corte",
  bed: "Cama",
  import_batch: "Importación",
  imported_record: "Histórico",
  visitor_sale: "Invitado",
  service_prices: "Precios",
};

const BED_STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  blocked: "Bloqueada",
};

const DIRECTION_LABELS: Record<string, string> = {
  income: "Ingreso",
  expense: "Egreso",
};

const RESERVATION_SOURCE_LABELS: Record<string, string> = {
  cashier_counter: "Recepción",
  guest_app: "App huésped",
  web: "Web",
};

function money(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `$${n.toFixed(2)}`;
}

function methodLabel(method: unknown) {
  if (typeof method !== "string") return null;
  return PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method;
}

export function parseAuditCategory(value: string | string[] | undefined): AuditCategory {
  const raw = Array.isArray(value) ? value[0] : value;
  const found = AUDIT_CATEGORY_FILTERS.find((item) => item.value === raw);
  return found?.value ?? "all";
}

export function getAuditCategoryActions(category: AuditCategory): string[] | null {
  return AUDIT_CATEGORY_FILTERS.find((item) => item.value === category)?.actions ?? null;
}

export function getAuditActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ");
}

export function getAuditEntityLabel(entityType: string) {
  return ENTITY_LABELS[entityType] ?? entityType.replaceAll("_", " ");
}

export function getAuditCategoryForAction(action: string): AuditCategory {
  for (const filter of AUDIT_CATEGORY_FILTERS) {
    if (filter.actions?.includes(action)) return filter.value;
  }
  return "all";
}

export function getAuditCategoryLabel(category: AuditCategory) {
  return AUDIT_CATEGORY_FILTERS.find((item) => item.value === category)?.toggleLabel ?? "Actividad";
}

export function formatAuditSummary(action: string, metadata: Record<string, unknown> | null) {
  const meta = metadata ?? {};

  switch (action) {
    case "reservation_created": {
      const folio = meta.folio_code ? `Folio ${meta.folio_code}` : "Nueva estadía";
      const guests = meta.guests_count ? `${meta.guests_count} huésped(es)` : null;
      const nights = meta.nights ? `${meta.nights} noche(s)` : null;
      const total = money(meta.total_amount);
      return [folio, guests, nights, total].filter(Boolean).join(" · ");
    }
    case "payment_registered": {
      const folio = meta.folio_code ? `Folio ${meta.folio_code}` : null;
      const amount = money(meta.amount);
      const method = methodLabel(meta.method);
      const balance = money(meta.balance_due);
      const parts = [folio, amount && method ? `${amount} (${method})` : amount, balance && `Saldo ${balance}`];
      return parts.filter(Boolean).join(" · ") || "Cobro registrado";
    }
    case "payment_reversed": {
      const folio = meta.folio_code ? `Folio ${meta.folio_code}` : null;
      const amount = money(meta.corrected_amount);
      const reason = meta.reason ? String(meta.reason) : null;
      return [folio, amount && `Corrección ${amount}`, reason].filter(Boolean).join(" · ");
    }
    case "expense_created": {
      const concept = getExpenseConceptLabel(String(meta.expense_concept ?? ""));
      const detail =
        meta.expense_concept === "extras" && meta.concept_detail
          ? `${concept}: ${meta.concept_detail}`
          : concept;
      const amount = money(meta.amount);
      const method = methodLabel(meta.method);
      return [detail, amount, method].filter(Boolean).join(" · ");
    }
    case "expense_updated": {
      const after = (meta.after ?? {}) as Record<string, unknown>;
      const concept = getExpenseConceptLabel(String(after.expense_concept ?? meta.expense_concept ?? ""));
      const amount = money(after.amount ?? meta.amount);
      const method = methodLabel(after.method ?? meta.method);
      return ["Edición", concept, amount, method].filter(Boolean).join(" · ");
    }
    case "cash_movement_created": {
      const direction = DIRECTION_LABELS[String(meta.direction)] ?? String(meta.direction);
      const amount = money(meta.amount);
      const method = methodLabel(meta.method);
      const category = meta.category ? String(meta.category) : null;
      return [direction, amount, method, category].filter(Boolean).join(" · ");
    }
    case "daily_cash_cut_generated": {
      const date = meta.date ? String(meta.date) : null;
      const income = money(meta.total_income);
      const net = money(meta.net_result);
      const leakage = meta.leakage_flag ? "Con diferencia" : "Cuadrado";
      return [date, income && `Ingresos ${income}`, net && `Neto ${net}`, leakage]
        .filter(Boolean)
        .join(" · ");
    }
    case "whatsapp_ticket_sent":
    case "payment_receipt_resent": {
      const folio = meta.folio_code ? `Folio ${meta.folio_code}` : null;
      const phone = meta.phone ? String(meta.phone) : null;
      const ok =
        action === "payment_receipt_resent" && "success" in meta
          ? meta.success
            ? "Enviado"
            : "Falló"
          : null;
      return [folio, phone, ok].filter(Boolean).join(" · ");
    }
    case "bed_reassigned": {
      return `De ${meta.old_bed ?? "—"} a cama ${meta.new_bed ?? "—"}`;
    }
    case "bed_status_updated": {
      const bed = meta.bed_number
        ? formatBedLabel(meta.bed_number as string | number, meta.zone as string | undefined) ??
          `Cama ${meta.bed_number}`
        : "Cama";
      const from = BED_STATUS_LABELS[String(meta.from)] ?? meta.from;
      const to = BED_STATUS_LABELS[String(meta.to)] ?? meta.to;
      return `${bed}: ${from} → ${to}`;
    }
    case "locker_assigned": {
      const locker = meta.locker_number ? `Locker ${meta.locker_number}` : "Locker";
      const days = meta.locker_days ? `${meta.locker_days} día(s)` : null;
      const amount = money(meta.locker_amount);
      return [locker, days, amount].filter(Boolean).join(" · ");
    }
    case "folio_extra_service_added": {
      const folio = meta.folio_code ? `Folio ${meta.folio_code}` : null;
      const service = meta.service_name ? String(meta.service_name) : "Servicio";
      const amount = money(meta.amount);
      return [folio, service, amount].filter(Boolean).join(" · ");
    }
    case "visitor_sale_registered":
    case "visitor_sale_deleted": {
      const concept = meta.concept === "locker" ? "Locker" : "Regadera";
      const number = meta.resource_number ? String(meta.resource_number) : null;
      const name = meta.visitor_name ? String(meta.visitor_name) : "Invitado";
      const amount = money(meta.amount);
      const method = methodLabel(meta.method);
      return [concept, number, name, amount, method].filter(Boolean).join(" · ");
    }
    case "import_preview_created":
      return meta.preview_count
        ? `${meta.preview_count} registro(s) en vista previa`
        : "Vista previa creada";
    case "import_batch_committed":
      return "Lote archivado en el sistema";
    case "import_record_recalculated":
      return meta.anomaly_count != null
        ? `${meta.anomaly_count} anomalía(s) detectada(s)`
        : "Registro recalculado";
    case "import_record_updated":
      return "Datos del registro histórico actualizados";
    case "service_prices_updated":
      return "Catálogo de tarifas operativas";
    default:
      return summarizeGenericMetadata(meta);
  }
}

function summarizeGenericMetadata(meta: Record<string, unknown>) {
  const parts: string[] = [];
  if (meta.folio_code) parts.push(`Folio ${meta.folio_code}`);
  if (meta.amount != null) {
    const amount = money(meta.amount);
    if (amount) parts.push(amount);
  }
  if (meta.phone) parts.push(String(meta.phone));
  if (parts.length > 0) return parts.join(" · ");
  return "Sin detalle adicional";
}

export function formatAuditDetailLines(
  action: string,
  metadata: Record<string, unknown> | null,
): string[] {
  const meta = metadata ?? {};
  const lines: string[] = [];

  const push = (label: string, value: unknown) => {
    if (value == null || value === "") return;
    lines.push(`${label}: ${String(value)}`);
  };

  switch (action) {
    case "reservation_created":
      push("Folio", meta.folio_code);
      push("Huéspedes", meta.guests_count);
      push("Noches", meta.nights);
      push("Total", money(meta.total_amount));
      push("Lockers", money(meta.locker_total));
      push(
        "Origen",
        RESERVATION_SOURCE_LABELS[String(meta.reservation_source)] ?? meta.reservation_source,
      );
      if (meta.promo_code) push("Promoción", meta.promo_code);
      if (meta.discount_percent) push("Descuento", `${meta.discount_percent}%`);
      break;
    case "payment_registered":
      push("Folio", meta.folio_code);
      push("Monto", money(meta.amount));
      push("Método", methodLabel(meta.method));
      push("Pagado acumulado", money(meta.paid_amount));
      push("Saldo", money(meta.balance_due));
      break;
    case "payment_reversed":
      push("Folio", meta.folio_code);
      push("Monto corregido", money(meta.corrected_amount));
      push("Motivo", meta.reason);
      push("Pago original", meta.original_payment_id);
      push("Pagado neto", money(meta.paid_amount));
      push("Saldo", money(meta.balance_due));
      break;
    case "daily_cash_cut_generated":
      push("Fecha", meta.date);
      push("Ingresos totales", money(meta.total_income));
      push("Ingresos huéspedes", money(meta.total_guest_income));
      push("Gastos", money(meta.total_expenses));
      push("Resultado neto", money(meta.net_result));
      push("Diferencia", money(meta.difference));
      if (meta.leakage_flag) lines.push("Alerta: diferencia en corte");
      break;
    default:
      for (const [key, value] of Object.entries(meta)) {
        if (value == null || value === "") continue;
        if (typeof value === "object") continue;
        const label = key.replaceAll("_", " ");
        if (key === "method") push(label, methodLabel(value));
        else if (key.includes("amount") || key.includes("income") || key.includes("total"))
          push(label, money(value) ?? value);
        else if (key === "expense_concept") push(label, getExpenseConceptLabel(String(value)));
        else if (key === "from" || key === "to")
          push(label, BED_STATUS_LABELS[String(value)] ?? value);
        else push(label, value);
      }
  }

  return lines;
}

export function parseAuditMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}
