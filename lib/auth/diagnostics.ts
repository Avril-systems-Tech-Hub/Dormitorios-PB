import { cookies } from "next/headers";

export async function getAuthTraceId() {
  const cookieStore = await cookies();
  return cookieStore.get("auth-diagnostic-trace")?.value ?? "none";
}

export function logAuthDiagnostic(
  phase: string,
  fields: Record<string, string | number | boolean | null | undefined>,
) {
  console.info(
    "[auth-diagnostic]",
    JSON.stringify({
      phase,
      ...fields,
    }),
  );
}

export function durationMs(startedAt: number) {
  return Number((performance.now() - startedAt).toFixed(1));
}
