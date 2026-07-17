import "server-only";

export const RECEPTION_LOGIN_DOMAIN = "staff.plazabasilica.cc";

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/;

export function normalizeStaffUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidStaffUsername(value: string) {
  return USERNAME_PATTERN.test(normalizeStaffUsername(value));
}

export function staffUsernameToEmail(value: string) {
  return `${normalizeStaffUsername(value)}@${RECEPTION_LOGIN_DOMAIN}`;
}

export function resolveStaffLoginEmail(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  if (normalized.includes("@")) {
    return normalized;
  }
  if (!isValidStaffUsername(normalized)) {
    return null;
  }
  return staffUsernameToEmail(normalized);
}
