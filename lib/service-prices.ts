import { createAdminClient } from "@/lib/supabase/admin";

export const SERVICE_PRICE_KEYS = [
  "bed_night",
  "guest_locker_day",
  "visitor_shower",
  "visitor_locker",
] as const;

export type ServicePriceKey = (typeof SERVICE_PRICE_KEYS)[number];

export const DEFAULT_SERVICE_PRICES: Record<ServicePriceKey, number> = {
  bed_night: 120,
  guest_locker_day: 30,
  visitor_shower: 20,
  visitor_locker: 20,
};

export const SERVICE_PRICE_LABELS: Record<ServicePriceKey, string> = {
  bed_night: "Dormitorio (noche)",
  guest_locker_day: "Locker con cama (día)",
  visitor_shower: "Regadera",
  visitor_locker: "Locker sin cama",
};

export const SERVICE_PRICE_HINTS: Record<ServicePriceKey, string> = {
  bed_night: "Tarifa por cama y noche, de 11:00 a 11:00.",
  guest_locker_day: "Locker extra para huésped con cama, por día.",
  visitor_shower: "Invitado: regadera de una exhibición.",
  visitor_locker: "Invitado: locker sin cama, una exhibición.",
};

export type ServicePrices = Record<ServicePriceKey, number>;

export type ServicePriceRow = {
  key: ServicePriceKey;
  label: string;
  amount: number;
};

export type VisitorCatalogPrices = {
  shower: number;
  locker: number;
};

export function isServicePriceKey(value: string): value is ServicePriceKey {
  return SERVICE_PRICE_KEYS.includes(value as ServicePriceKey);
}

function asAmount(value: unknown, fallback: number): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : fallback;
}

export async function getServicePrices(): Promise<ServicePrices> {
  const prices: ServicePrices = { ...DEFAULT_SERVICE_PRICES };
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("service_prices")
      .select("key, amount")
      .in("key", [...SERVICE_PRICE_KEYS]);
    for (const row of data ?? []) {
      const key = row.key as ServicePriceKey;
      if (key in prices) {
        prices[key] = asAmount(row.amount, prices[key]);
      }
    }
  } catch (error) {
    console.error("[getServicePrices] fallback to defaults:", error);
  }
  return prices;
}

export async function getServicePriceCatalog(): Promise<ServicePriceRow[]> {
  const prices = await getServicePrices();
  const labels: Record<ServicePriceKey, string> = { ...SERVICE_PRICE_LABELS };
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("service_prices")
      .select("key, label")
      .in("key", [...SERVICE_PRICE_KEYS]);
    for (const row of data ?? []) {
      const key = row.key as ServicePriceKey;
      if (key in labels && typeof row.label === "string" && row.label.trim()) {
        labels[key] = row.label.trim();
      }
    }
  } catch (error) {
    console.error("[getServicePriceCatalog] labels fallback:", error);
  }
  return SERVICE_PRICE_KEYS.map((key) => ({
    key,
    label: labels[key],
    amount: prices[key],
  }));
}

export async function getVisitorCatalogPrices(): Promise<VisitorCatalogPrices> {
  const prices = await getServicePrices();
  return {
    shower: prices.visitor_shower,
    locker: prices.visitor_locker,
  };
}
