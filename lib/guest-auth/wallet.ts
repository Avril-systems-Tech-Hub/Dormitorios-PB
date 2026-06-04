const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function normalizeWalletAddress(address: string) {
  const trimmed = address.trim();
  if (!EVM_ADDRESS_RE.test(trimmed)) {
    throw new Error("Dirección de wallet inválida.");
  }
  return trimmed.toLowerCase();
}

export function normalizeGuestPhone(value: string) {
  return value.replace(/\D/g, "");
}

const LOGIN_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeLoginEmail(value: string | undefined | null): string | null {
  if (!value) return null;
  const email = value.trim().toLowerCase();
  if (!LOGIN_EMAIL_RE.test(email)) return null;
  return email;
}

export function shortenAddress(address: string) {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
