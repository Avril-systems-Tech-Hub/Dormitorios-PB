/** Max length for a physical locker label (e.g. A1, B-12). */
const LOCKER_CODE_MAX_LEN = 10;

/**
 * Normalize a locker label for storage/display.
 * Accepts letters, digits, and optional hyphen (e.g. "a1" → "A1").
 * Returns null when empty; throws nothing — callers decide how to treat invalid input.
 */
export function normalizeLockerCode(
  raw: string | number | null | undefined,
): string | null {
  if (raw == null) return null;
  const value = String(raw).trim().toUpperCase();
  if (!value) return null;
  if (value.length > LOCKER_CODE_MAX_LEN) return null;
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)?$/.test(value)) return null;
  return value;
}

export function isLockerCodeAssigned(
  value: string | number | null | undefined,
): boolean {
  return normalizeLockerCode(value) != null;
}
