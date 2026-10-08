import { describe, expect, it, vi } from "vitest";
import { rateDecision, resolvePhotoBatch, type RateDecision } from "./rate-limit";

describe("rateDecision", () => {
  it("1. allows only on explicit true", () => expect(rateDecision(true, null)).toBe("allow"));
  it("2. false means limit exceeded", () => expect(rateDecision(false, null)).toBe("limited"));
  it("3. RPC error denies even if data is true", () => expect(rateDecision(true, { message: "x" })).toBe("unavailable"));
  it("3. unexpected results deny", () => {
    for (const v of [null, undefined, "true", 1, {}, []]) expect(rateDecision(v, null)).toBe("unavailable");
  });
});

function setup(cache: Record<string, string>, decisions: RateDecision[] | (() => Promise<RateDecision>)) {
  const fetchUrl = vi.fn(async (n: string) => `g:${n}`);
  let i = 0;
  const checkLimit = vi.fn(typeof decisions === "function" ? decisions : async () => decisions[i++] ?? "unavailable");
  return { fetchUrl, checkLimit, deps: { cacheGet: (n: string) => cache[n] ?? null, checkLimit, fetchUrl } };
}

describe("resolvePhotoBatch", () => {
  it("1. authorized: calls Google", async () => {
    const s = setup({}, ["allow"]);
    expect(await resolvePhotoBatch(["a"], s.deps)).toEqual({ a: "g:a" });
    expect(s.fetchUrl).toHaveBeenCalledTimes(1);
  });
  it("2. exceeded: no external call", async () => {
    const s = setup({}, ["limited", "limited"]);
    expect(await resolvePhotoBatch(["a", "b"], s.deps)).toEqual({});
    expect(s.fetchUrl).not.toHaveBeenCalled();
  });
  it("3. RPC error/unexpected or thrown check: no external call", async () => {
    const s = setup({}, ["unavailable"]);
    await resolvePhotoBatch(["a"], s.deps);
    const t = setup({}, () => Promise.reject(new Error("down")));
    await resolvePhotoBatch(["a"], t.deps);
    expect(s.fetchUrl).not.toHaveBeenCalled();
    expect(t.fetchUrl).not.toHaveBeenCalled();
  });
  it("4. cached photos return without limiter or Google calls", async () => {
    const s = setup({ a: "c:a", b: "c:b" }, []);
    expect(await resolvePhotoBatch(["a", "b"], s.deps)).toEqual({ a: "c:a", b: "c:b" });
    expect(s.checkLimit).not.toHaveBeenCalled();
    expect(s.fetchUrl).not.toHaveBeenCalled();
  });
  it("5. partial grant: only granted count calls Google, cache still served", async () => {
    const s = setup({ z: "c:z" }, ["allow", "limited", "unavailable", "allow"]);
    const out = await resolvePhotoBatch(["z", "a", "b", "c", "d"], s.deps);
    expect(s.fetchUrl).toHaveBeenCalledTimes(2);
    expect(out).toEqual({ z: "c:z", a: "g:a", b: "g:b" });
  });
});
