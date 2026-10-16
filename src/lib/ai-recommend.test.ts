import { describe, expect, it } from "vitest";
import { MAX_PICKS, parsePicks } from "./ai-recommend";

describe("parsePicks", () => {
  it("drops places that are not in the real Google list", () => {
    const text = '{"picks":[{"id":"real1","reason":"ok"},{"id":"inventado","reason":"x"}]}';
    expect(parsePicks(text, ["real1", "real2"])).toEqual([{ id: "real1", reason: "ok" }]);
  });
  it("returns at most 3 picks without duplicates", () => {
    const ids = ["a", "b", "c", "d"];
    const text = JSON.stringify({ picks: ["a", "a", "b", "c", "d"].map((id) => ({ id, reason: "r" })) });
    const out = parsePicks(text, ids);
    expect(MAX_PICKS).toBe(3);
    expect(out.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
  it("returns nothing for malformed output", () => {
    expect(parsePicks("desculpe, não sei", ["a"])).toEqual([]);
  });
});
