/** Friendly Portuguese message for a failed action; the technical error always goes to the console. */
export const OFFLINE_MSG = "Sem conexão. Tente de novo.";

export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : "";
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg);
}

export function friendlyError(err: unknown, fallback: string, context?: string): string {
  console.error(`[erro]${context ? ` ${context}` : ""}`, err);
  return isNetworkError(err) ? OFFLINE_MSG : fallback;
}
