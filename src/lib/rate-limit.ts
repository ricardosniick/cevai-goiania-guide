import { splitByCache, withinBudget } from "./photo-budget";

export const RATE_MSG = "Muitas tentativas. Tente de novo em alguns instantes.";
export const RATE_UNAVAILABLE_MSG = "Não foi possível consultar agora. Tente de novo em alguns instantes.";
/** Shown when the app-wide Google budget is exhausted, not configured, or the limiter fails. */
export const GLOBAL_UNAVAILABLE_MSG = "As consultas de lugares estão temporariamente indisponíveis. Tente de novo mais tarde.";

export type RateDecision = "allow" | "limited" | "unavailable";

/** Only an explicit `true` from hit_rate_limit authorizes a paid call; errors or unexpected values never do. */
export function rateDecision(data: unknown, error: unknown): RateDecision {
  if (error) return "unavailable";
  if (data === true) return "allow";
  if (data === false) return "limited";
  return "unavailable";
}

/** Billing buckets of reserve_global_budget (must match the SQL CHECK). */
export type GlobalBucket = "text_search" | "nearby_search" | "details_full" | "details_basic" | "photo";

export type GlobalStatus = "granted" | "exhausted" | "unconfigured" | "unavailable";

/**
 * Interprets reserve_global_budget: n>0 granted, 0 exhausted, -1 not configured.
 * Anything else (error, non-integer, more than requested, other negatives) grants nothing.
 */
export function globalDecision(data: unknown, error: unknown, requested: number): { status: GlobalStatus; granted: number } {
  if (error) return { status: "unavailable", granted: 0 };
  if (typeof data !== "number" || !Number.isInteger(data)) return { status: "unavailable", granted: 0 };
  if (data === -1) return { status: "unconfigured", granted: 0 };
  if (data === 0) return { status: "exhausted", granted: 0 };
  if (data > 0 && data <= requested) return { status: "granted", granted: data };
  return { status: "unavailable", granted: 0 };
}

/**
 * Cached photos are returned freely. For the misses: optional per-person grants first, then one global
 * reservation for that many; only `granted` photos are fetched from Google, the rest show "sem foto".
 */
export async function resolvePhotoBatch(
  names: string[],
  deps: {
    cacheGet: (n: string) => string | null;
    checkLimit?: () => Promise<RateDecision>;
    reserveGlobal: (count: number) => Promise<number>;
    fetchUrl: (n: string) => Promise<string | null>;
  },
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const { cached, missing } = splitByCache(names, (n) => !!deps.cacheGet(n));
  cached.forEach((n) => { const c = deps.cacheGet(n); if (c) out[n] = c; });
  if (!missing.length) return out; console.log("DBGM", missing, cached);
  let personal = missing.length;
  if (deps.checkLimit) {
    const check = deps.checkLimit;
    const decisions = await Promise.all(missing.map(() => check().catch((): RateDecision => "unavailable")));
    personal = decisions.filter((d) => d === "allow").length;
  }
  if (personal <= 0) return out;
  const raw = await deps.reserveGlobal(personal).catch(() => 0);
  const granted = Number.isInteger(raw) && raw > 0 ? Math.min(raw, personal) : 0;
  const allowed = withinBudget(missing, granted);
  await Promise.all(allowed.map(async (n) => { const u = await deps.fetchUrl(n).catch(() => null); if (u) out[n] = u; }));
  return out;
}
