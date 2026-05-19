export type GuestConfirmationGuest = {
  full_name: string;
  phone: string;
  email: string;
  locker_days: number;
  locker_amount: number;
  bed_number?: number;
};

export type CreateGuestReservationResult =
  | { ok: true; confirmation: GuestConfirmationPayload }
  | { ok: false; error: string };

export type GuestConfirmationPayload = {
  folio: string;
  check_in: string;
  check_out: string;
  nights: number;
  bed_subtotal: number;
  locker_total: number;
  total_amount: number;
  notes?: string;
  guests: GuestConfirmationGuest[];
};

export function encodeGuestConfirmationPayload(payload: GuestConfirmationPayload): string {
  const json = JSON.stringify(payload);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8").toString("base64url");
  }
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeGuestConfirmationPayload(encoded: string): GuestConfirmationPayload | null {
  try {
    let json: string;
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(encoded, "base64url").toString("utf8");
    } else {
      const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
      const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
      const binary = atob(base64 + pad);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      json = new TextDecoder().decode(bytes);
    }
    const parsed = JSON.parse(json) as GuestConfirmationPayload;
    if (!parsed?.folio || !parsed?.guests?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildGuestConfirmationRedirect(
  basePath: string,
  payload: GuestConfirmationPayload,
): string {
  const safeBase = basePath.startsWith("/") ? basePath : "/";
  const [pathWithoutHash, hash = ""] = safeBase.split("#");
  const encoded = encodeGuestConfirmationPayload(payload);
  const joiner = pathWithoutHash.includes("?") ? "&" : "?";
  const queryPart = `${pathWithoutHash}${joiner}confirmed=1&confirmation=${encoded}`;
  const withHash = hash ? `${queryPart}#${hash}` : `${queryPart}#reserva`;
  return withHash;
}

export function formatReservationDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
