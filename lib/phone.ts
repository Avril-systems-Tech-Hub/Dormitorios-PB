/** Mexico country calling code (without +). */
export const MEXICO_COUNTRY_CODE = "52";

/** E.164 prefix shown in guest / WaaP flows. */
export const MEXICO_PHONE_PREFIX = `+${MEXICO_COUNTRY_CODE}`;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Normalize to a 10-digit Mexican mobile (area code + número local).
 * Accepts +52, 52, optional leading 1, and strips formatting.
 */
export function normalizeMexicanPhone(value: string): string {
  let digits = digitsOnly(value);
  if (!digits) return "";

  if (digits.startsWith("521") && digits.length >= 13) {
    digits = digits.slice(3);
  } else if (digits.startsWith("52") && digits.length > 10) {
    digits = digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  return digits;
}

/** E.164 for APIs that require country code (e.g. WaaP SMS). */
export function formatMexicanPhoneE164(value: string): string {
  const ten = normalizeMexicanPhone(value);
  if (ten.length !== 10) return "";
  return `${MEXICO_PHONE_PREFIX}${ten}`;
}

export function isCompleteMexicanPhone(value: string): boolean {
  return normalizeMexicanPhone(value).length === 10;
}

/** Keep at most 10 national digits while the user types. */
export function sanitizeMexicanPhoneInput(raw: string): string {
  const digits = digitsOnly(raw);
  if (digits.startsWith("52") || digits.startsWith("521")) {
    return normalizeMexicanPhone(raw);
  }
  return digits.slice(0, 10);
}
