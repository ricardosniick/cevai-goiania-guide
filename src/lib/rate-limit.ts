import { splitByCache, withinBudget } from "./photo-budget";

export const RATE_MSG = "Muitas tentativas. Tente de novo em alguns instantes.";
export const RATE_UNAVAILABLE_MSG = "Não foi possível consultar agora. Tente de novo em alguns instantes.";

export type RateDecision = "allow" | "limited" | "unavailable";

/** Only an explicit `true` from hit_rate_limit authorizes a paid call; errors or unexpected values never do. */
export function rateDecision(data: unknown, error: unknown): RateDecision {
  if (error) return "unavailable";
  if (data === true) return "allow";
  if (data === false) return "limited";
  return "unavailable";
}

/** Cached photos are returned freely; each missing one needs an explicit grant before calling Google. */
export async function resolvePhotoBatch(
  names: string[],
  deps: {
    cacheGet: (n: string) => string | null;
    checkLimit: () => Promise<RateDecision>;
    fetchUrl: (n: string) => Promise<string | null>;
  },
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const { cached, missing } = splitByCache(names, (n) => !!deps.cacheGet(n));
  cached.forEach((n) => { const c = deps.cacheGet(n); if (c) out[n] = c; });
  if (!missing.length) return out;
  const decisions = await Promise.all(missing.map(() => deps.checkLimit().catch((): RateDecision => "unavailable")));
  const allowed = withinBudget(missing, decisions.filter((d) => d === "allow").length);
  await Promise.all(allowed.map(async (n) => { const u = await deps.fetchUrl(n); if (u) out[n] = u; }));
  return out;
}
