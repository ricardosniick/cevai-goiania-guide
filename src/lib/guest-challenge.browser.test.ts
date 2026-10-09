import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TURNSTILE_SITE_KEY, getGuestChallengeToken, resolveTurnstileSiteKey } from "./guest-challenge.browser";
import { GUEST_CHALLENGE_MSG } from "./guest-challenge";
type Options = Parameters<NonNullable<Window["turnstile"]>["render"]>[1];
let callbacks: Options[];
const remove = vi.fn();
beforeEach(() => {
  callbacks = []; remove.mockReset();
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "public-test-sitekey");
  window.turnstile = { render: (_element, options) => { callbacks.push(options); return String(callbacks.length); }, execute: vi.fn(), remove };
});
afterEach(() => { delete window.turnstile; vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("guest challenge client", () => {
  it("concurrent requests receive separate single-use tokens and remove widgets", async () => {
    const a = getGuestChallengeToken(); const b = getGuestChallengeToken();
    await Promise.resolve();
    expect(callbacks).toHaveLength(2);
    expect(callbacks[0]!).toMatchObject({ action: "guest_places", execution: "execute", appearance: "interaction-only" });
    callbacks[0]!.callback("token-a"); callbacks[1]!.callback("token-b");
    expect(await Promise.all([a, b])).toEqual(["token-a", "token-b"]);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[aria-label="Verificação de segurança"]')).toBeNull();
  });
  it.each(["error-callback", "expired-callback", "timeout-callback"] as const)("cleans up after %s", async event => {
    const result = getGuestChallengeToken();
    const rejected = expect(result).rejects.toThrow(GUEST_CHALLENGE_MSG);
    await Promise.resolve(); callbacks[0]![event](); await rejected;
    expect(remove).toHaveBeenCalledTimes(1);
  });
  it("cancelled screen cannot continue a request", async () => {
    const controller = new AbortController();
    const result = getGuestChallengeToken(controller.signal);
    const rejected = expect(result).rejects.toThrow(GUEST_CHALLENGE_MSG);
    await Promise.resolve(); controller.abort(); callbacks[0]!.callback("late-token"); await rejected;
    expect(remove).toHaveBeenCalledTimes(1);
  });
  it("missing env uses the public default and still requires a challenge", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    const token = getGuestChallengeToken();
    await Promise.resolve();
    expect(callbacks).toHaveLength(1);
    expect(callbacks[0]!.sitekey).toBe(DEFAULT_TURNSTILE_SITE_KEY);
    callbacks[0]!.callback("token-default");
    expect(await token).toBe("token-default");
  });
  it("provider script failure cleans up and permits a later attempt", async () => {
    delete window.turnstile;
    const first = getGuestChallengeToken();
    const rejected = expect(first).rejects.toThrow(GUEST_CHALLENGE_MSG);
    const script = document.querySelector<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/"]')!;
    script.dispatchEvent(new Event("error")); await rejected;
    expect(script.isConnected).toBe(false);
    const second = getGuestChallengeToken();
    const newScript = document.querySelector<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/"]')!;
    expect(newScript).not.toBe(script);
    window.turnstile = { render: (_element, options) => { callbacks.push(options); return "retried"; }, execute: vi.fn(), remove };
    newScript.dispatchEvent(new Event("load"));
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    callbacks[0]!.callback("retry-token");
    expect(await second).toBe("retry-token");
    newScript.remove();
  });
  it("never waits indefinitely for a challenge", async () => {
    vi.useFakeTimers();
    const result = getGuestChallengeToken();
    const rejected = expect(result).rejects.toThrow(GUEST_CHALLENGE_MSG);
    await Promise.resolve(); await vi.advanceTimersByTimeAsync(120000); await rejected;
    expect(remove).toHaveBeenCalledTimes(1);
    expect(document.getElementById("cevai-guest-verification")).toBeNull();
  });
});

describe("public site key configuration", () => {
  it("uses an explicit environment key first", () => {
    expect(resolveTurnstileSiteKey("  0xENV  ")).toBe("0xENV");
  });
  it("uses the public default for absent or blank environment values", () => {
    expect(resolveTurnstileSiteKey(undefined)).toBe("0x4AAAAAAFST2lM6mrSDqNSA");
    expect(resolveTurnstileSiteKey("  ")).toBe(DEFAULT_TURNSTILE_SITE_KEY);
  });
});
