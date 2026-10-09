import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyGuestChallenge } from "./guest-challenge.server";
import { GUEST_CHALLENGE_MSG } from "./guest-challenge";
const request = vi.fn();
const proof = () => ({ success: true, action: "guest_places", hostname: "app.example.test", challenge_ts: new Date().toISOString() });
beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue(new Response(JSON.stringify(proof())));
  vi.stubGlobal("fetch", request);
  vi.stubEnv("TURNSTILE_SECRET_KEY", "unit-test-secret");
  vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "app.example.test, preview.example.test");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("server-side guest proof", () => {
  it("verifies against the fixed provider with server-owned secret", async () => {
    await verifyGuestChallenge("fresh-proof");
    const [url, options] = request.mock.calls[0]!;
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(options.body.get("response")).toBe("fresh-proof");
    expect(options.body.get("secret")).toBe("unit-test-secret");
    expect(options.redirect).toBe("error");
  });
  it.each([undefined, null, "", " ", 1, "a".repeat(2049)])("rejects missing/malformed token %s locally", async token => {
    await expect(verifyGuestChallenge(token)).rejects.toThrow(GUEST_CHALLENGE_MSG);
    expect(request).not.toHaveBeenCalled();
  });
  it.each(["TURNSTILE_SECRET_KEY", "TURNSTILE_ALLOWED_HOSTNAMES"])("fails closed without %s", async key => {
    vi.stubEnv(key, "");
    await expect(verifyGuestChallenge("proof")).rejects.toThrow(GUEST_CHALLENGE_MSG);
    expect(request).not.toHaveBeenCalled();
  });
  it.each([
    { success: false, "error-codes": ["timeout-or-duplicate"] }, { success: "true" },
    { action: "another_action" }, { hostname: "attacker.example.test" },
    { hostname: "app.example.test.attacker.test" }, { challenge_ts: "invalid" },
    { challenge_ts: new Date(Date.now() - 301000).toISOString() },
    { challenge_ts: new Date(Date.now() + 60000).toISOString() },
  ])("rejects failed, expired or mismatched proof: %j", async override => {
    request.mockResolvedValue(new Response(JSON.stringify({ ...proof(), ...override })));
    await expect(verifyGuestChallenge("proof")).rejects.toThrow(GUEST_CHALLENGE_MSG);
  });
  it.each([null, [], true, {}])("rejects malformed response %j", async body => {
    request.mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(verifyGuestChallenge("proof")).rejects.toThrow(GUEST_CHALLENGE_MSG);
  });
  it("does not cache successful tokens; provider rejects replay", async () => {
    request.mockResolvedValueOnce(new Response(JSON.stringify(proof())))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] })));
    await verifyGuestChallenge("one-use-token");
    await expect(verifyGuestChallenge("one-use-token")).rejects.toThrow(GUEST_CHALLENGE_MSG);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("blocks provider outage, bad JSON and HTTP failure", async () => {
    request.mockRejectedValueOnce(new Error("timeout"));
    await expect(verifyGuestChallenge("proof")).rejects.toThrow(GUEST_CHALLENGE_MSG);
    request.mockResolvedValueOnce(new Response("invalid json"));
    await expect(verifyGuestChallenge("proof")).rejects.toThrow(GUEST_CHALLENGE_MSG);
    request.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    await expect(verifyGuestChallenge("proof")).rejects.toThrow(GUEST_CHALLENGE_MSG);
  });
});
