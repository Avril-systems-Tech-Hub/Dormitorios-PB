import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** True when a server action completed via Next.js redirect (success or error toast). */
export function isNextRedirect(error: unknown): boolean {
  if (error instanceof Error && error.message === "NEXT_REDIRECT") return true;
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: string }).digest === "string" &&
    (error as { digest?: string }).digest!.startsWith("NEXT_REDIRECT")
  );
}

/**
 * Runs a server action and invokes onComplete when it finishes or redirects.
 * Re-throws redirect errors so Next.js navigation still works.
 */
export async function runServerActionWithClose(
  action: () => Promise<void>,
  onComplete: () => void,
): Promise<void> {
  try {
    await action();
    onComplete();
  } catch (error) {
    if (isNextRedirect(error)) {
      onComplete();
      throw error;
    }
    throw error;
  }
}
