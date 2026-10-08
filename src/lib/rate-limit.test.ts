import { describe, expect, it, vi } from "vitest";
import { globalDecision, rateDecision, resolvePhotoBatch, type RateDecision } from "./rate-limit";

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
  const reserveGlobal = vi.fn(async (n: number) => n);
  return { fetchUrl, checkLimit, reserveGlobal, deps: { cacheGet: (n: string) => cache[n] ?? null, checkLimit, reserveGlobal, fetchUrl } };
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

describe("globalDecision (reserve_global_budget)", () => {
  it("n>0 até o pedido concede n", () => expect(globalDecision(3, null, 5)).toEqual({ status: "granted", granted: 3 }));
  it("0 = teto atingido", () => expect(globalDecision(0, null, 1)).toEqual({ status: "exhausted", granted: 0 }));
  it("-1 = não configurado", () => expect(globalDecision(-1, null, 1)).toEqual({ status: "unconfigured", granted: 0 }));
  it("erro bloqueia mesmo com número", () => expect(globalDecision(1, { message: "x" }, 1).granted).toBe(0));
  it("valores inesperados bloqueiam", () => {
    for (const v of [null, undefined, true, "1", 1.5, -2, 6, NaN, {}]) expect(globalDecision(v, null, 5)).toEqual({ status: "unavailable", granted: 0 });
  });
});

describe("resolvePhotoBatch + teto global", () => {
  it("limite por pessoa antes do global; global recebe só os autorizados", async () => {
    const order: string[] = [];
    const s = setup({}, async () => { order.push("user"); return "allow"; });
    s.reserveGlobal.mockImplementation(async (n: number) => { order.push(`global:${n}`); return n; });
    await resolvePhotoBatch(["a", "b"], s.deps);
    expect(order).toEqual(["user", "user", "global:2"]);
  });
  it("sem autorização por pessoa, não reserva global", async () => {
    const s = setup({}, ["limited"]);
    await resolvePhotoBatch(["a"], s.deps);
    expect(s.reserveGlobal).not.toHaveBeenCalled();
  });
  it("reserva parcial: no máximo a quantidade concedida", async () => {
    const s = setup({}, async () => "allow");
    s.reserveGlobal.mockResolvedValue(2);
    const out = await resolvePhotoBatch(["a", "b", "c", "d"], s.deps);
    expect(s.fetchUrl).toHaveBeenCalledTimes(2);
    expect(Object.keys(out)).toEqual(["a", "b"]);
  });
  it("global retornando mais que o pedido não libera extras", async () => {
    const s = setup({}, async () => "allow");
    s.reserveGlobal.mockResolvedValue(99);
    const out = await resolvePhotoBatch(["a", "b"], s.deps);
    expect(s.fetchUrl).not.toHaveBeenCalled();
    expect(out).toEqual({});
  });
  it.each([0, -1, 1.5, NaN])("global %s → nenhuma chamada", async (v) => {
    const s = setup({}, async () => "allow");
    s.reserveGlobal.mockResolvedValue(v);
    await resolvePhotoBatch(["a"], s.deps);
    expect(s.fetchUrl).not.toHaveBeenCalled();
  });
  it("global lançando exceção → nenhuma chamada", async () => {
    const s = setup({}, async () => "allow");
    s.reserveGlobal.mockRejectedValue(new Error("down"));
    await resolvePhotoBatch(["a"], s.deps);
    expect(s.fetchUrl).not.toHaveBeenCalled();
  });
  it("sem checkLimit (busca/detalhes) vai direto ao global; cache não reserva", async () => {
    const s = setup({ a: "c:a" }, []);
    const { checkLimit: _c, ...deps } = s.deps;
    await resolvePhotoBatch(["a", "b"], deps);
    expect(s.reserveGlobal).toHaveBeenCalledWith(1);
    expect(s.fetchUrl).toHaveBeenCalledWith("b");
  });
  it("só cache → nenhuma reserva", async () => {
    const s = setup({ a: "c:a" }, []);
    await resolvePhotoBatch(["a"], s.deps);
    expect(s.reserveGlobal).not.toHaveBeenCalled();
  });
});
