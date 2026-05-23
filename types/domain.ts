export type UserRole = string;

export type BedStatus = "available" | "blocked";

export type PaymentMethod = "cash" | "transfer" | "card";

export type PaymentType = "advance" | "settlement" | "extra";

export type FolioPaymentStatus = "pending" | "partial" | "liquidated";

export type GuestSex = "f" | "m" | "x" | "unknown";

export type CashMovementDirection = "income" | "expense";

export type CashMovementCategory =
  | "sale"
  | "gasto_operativo"
  | "gasto_administrativo"
  | "gasto_cubrir_dias"
  | "contadora"
  | "other";

export type ExpenseConcept =
  | "sueldos"
  | "lavanderia"
  | "limpieza"
  | "papeleria"
  | "papel_bano"
  | "basura"
  | "medicamento"
  | "jabon_bano"
  | "gas"
  | "mantenimiento"
  | "internet"
  | "agua"
  | "luz"
  | "cobijas"
  | "extras";

export type WhatsAppStatus = "queued" | "sent" | "failed";
export type ReservationSource = "guest_app" | "cashier_counter";

export type ImportBatchStatus = "draft" | "previewed" | "imported" | "failed";

export type AnomalyFlag =
  | "BED_AMOUNT_MISMATCH"
  | "LOCKER_AMOUNT_MISMATCH"
  | "TOTAL_MISMATCH"
  | "EXTRA_SERVICE_REVIEW"
  | "MISSING_TOTAL"
  | "MISSING_BED"
  | "INVALID_DATE_RANGE"
  | "LOCKER_NUMBER_WITHOUT_CHARGE"
  | "LOCKER_CHARGE_WITHOUT_LOCKER_NUMBER"
  | "BED_OVERLAP_REVIEW"
  | "LONG_STAY_REVIEW"
  | "NEEDS_MANUAL_REVIEW"
  | "UNREADABLE_FIELD"
  | "MISSING_REQUIRED_FIELD";
