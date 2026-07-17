import "server-only";

export const RECEPTION_LOGIN_DOMAIN = "staff.plazabasilica.cc";

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/;

export function normalizeStaffUsername(value: string) {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

export function isValidStaffUsername(value: string) {
  return USERNAME_PATTERN.test(normalizeStaffUsername(value));
}

export function staffUsernameToEmail(value: string) {
  return `${normalizeStaffUsername(value)}@${RECEPTION_LOGIN_DOMAIN}`;
}

/**
 * Accept email, username, or "@username" (as shown in older admin lists).
 * Returns the auth email used by Supabase, or null if the identifier is invalid.
 */
export function resolveStaffLoginEmail(identifier: string) {
  const trimmed = identifier.trim().toLowerCase();
  if (!trimmed) return null;

  // "@arturo" from the users UI must resolve as username, not as an email.
  if (trimmed.startsWith("@")) {
    const username = normalizeStaffUsername(trimmed);
    if (!isValidStaffUsername(username)) return null;
    return staffUsernameToEmail(username);
  }

  if (trimmed.includes("@")) {
    return trimmed;
  }

  if (!isValidStaffUsername(trimmed)) {
    return null;
  }
  return staffUsernameToEmail(trimmed);
}
