import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const GUEST_SESSION_COOKIE = "guest_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

// Split keys so Next.js does not replace process.env.* with undefined at build time.
const GUEST_SESSION_SECRET_KEY = ["GUEST", "SESSION", "SECRET"].join("_");
const SERVICE_ROLE_KEY = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");

export type GuestSession = {
  guestId: string;
  walletAddress: string;
  exp: number;
};

export class GuestSessionConfigError extends Error {
  constructor() {
    super("Missing GUEST_SESSION_SECRET.");
    this.name = "GuestSessionConfigError";
  }
}

function readRuntimeEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function deriveGuestSessionSecret(serviceRoleKey: string): string {
  return createHmac("sha256", "dormitorios-guest-session-v1")
    .update(serviceRoleKey)
    .digest("base64url");
}

function getSessionSecret(): string {
  const explicit = readRuntimeEnv(GUEST_SESSION_SECRET_KEY);
  if (explicit) return explicit;

  if (process.env.NODE_ENV === "development") {
    return "dev-guest-session-secret";
  }

  const serviceRole = readRuntimeEnv(SERVICE_ROLE_KEY);
  if (serviceRole) {
    return deriveGuestSessionSecret(serviceRole);
  }

  throw new GuestSessionConfigError();
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function serializeGuestSession(session: Omit<GuestSession, "exp">) {
  const payload = Buffer.from(
    JSON.stringify({
      ...session,
      exp: Date.now() + SESSION_TTL_MS,
    } satisfies GuestSession),
  ).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function parseGuestSession(value: string | undefined): GuestSession | null {
  if (!value) return null;

  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  try {
    const expected = signPayload(payload);
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as GuestSession;
    if (!session.guestId || !session.walletAddress || !session.exp) return null;
    if (session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getGuestSession(): Promise<GuestSession | null> {
  const cookieStore = await cookies();
  return parseGuestSession(cookieStore.get(GUEST_SESSION_COOKIE)?.value);
}

export async function setGuestSessionCookie(session: Omit<GuestSession, "exp">) {
  const cookieStore = await cookies();
  cookieStore.set(GUEST_SESSION_COOKIE, serializeGuestSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearGuestSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_SESSION_COOKIE);
}
