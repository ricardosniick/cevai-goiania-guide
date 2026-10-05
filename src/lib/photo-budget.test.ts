import { describe, expect, it } from "vitest";
import { splitByCache, withinBudget, PHOTO_NEW_PER_MINUTE } from "./photo-budget";

describe("splitByCache", () => {
  it("separates cached and missing names, dropping duplicates", () => {
    const cache = new Set(["a", "c"]);
    expect(splitByCache(["a", "b", "c", "b", "d"], (n) => cache.has(n))).toEqual({ cached: ["a", "c"], missing: ["b", "d"] });
  });

  it("counts nothing when everything is cached", () => {
    expect(splitByCache(["a", "b"], () => true).missing).toEqual([]);
  });

  it("handles an empty list", () => {
    expect(splitByCache([], () => false)).toEqual({ cached: [], missing: [] });
  });
});

describe("withinBudget", () => {
  const missing = ["a", "b", "c", "d"];
  it("allows all misses when the budget covers them", () => expect(withinBudget(missing, 4)).toEqual(missing));
  it("allows only the granted number", () => expect(withinBudget(missing, 2)).toEqual(["a", "b"]));
  it("allows nothing when over the limit", () => expect(withinBudget(missing, 0)).toEqual([]));
  it("ignores negative or excess grants", () => {
    expect(withinBudget(missing, -1)).toEqual([]);
    expect(withinBudget(missing, 10)).toEqual(missing);
  });
  it("uses a 120 new photos per minute limit", () => expect(PHOTO_NEW_PER_MINUTE).toBe(120));
});
