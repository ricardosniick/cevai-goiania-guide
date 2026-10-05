// Pure helpers for the photo URL rate limit: only photos missing from the cache spend the per-person budget.
export const PHOTO_NEW_PER_MINUTE = 120;

/** Deduplicates names and splits them into cache hits and misses (order preserved). */
export function splitByCache(names: string[], isCached: (name: string) => boolean): { cached: string[]; missing: string[] } {
  const cached: string[] = [];
  const missing: string[] = [];
  for (const n of new Set(names)) (isCached(n) ? cached : missing).push(n);
  return { cached, missing };
}

/** The misses that may be fetched given how many budget slots were granted; the rest fall back to "sem foto". */
export function withinBudget(missing: string[], granted: number): string[] {
  return missing.slice(0, Math.max(0, Math.min(granted, missing.length)));
}
