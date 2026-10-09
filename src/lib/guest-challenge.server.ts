import { GUEST_CHALLENGE_ACTION, GUEST_CHALLENGE_MSG } from "./guest-challenge";

/** Verify every guest request with Cloudflare; tokens are single-use, never cached. */
export async function verifyGuestChallenge(token: unknown): Promise<void> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  const hosts = (process.env["TURNSTILE_ALLOWED_HOSTNAMES"] ?? "").split(",").map(h => h.trim().toLowerCase()).filter(Boolean);
  if (!secret || !hosts.length || hosts.some(h => !/^[a-z0-9.-]+$/.test(h)) ||
      typeof token !== "string" || !token.trim() || token.length > 2048) {
    throw new Error(GUEST_CHALLENGE_MSG);
  }
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    if (!response.ok) throw new Error("verification unavailable");
    const result: unknown = await response.json();
    if (!result || typeof result !== "object") throw new Error("invalid verification");
    const proof = result as Record<string, unknown>;
    const timestamp = typeof proof["challenge_ts"] === "string" ? Date.parse(proof["challenge_ts"]) : NaN;
    const age = Date.now() - timestamp;
    if (proof["success"] !== true || proof["action"] !== GUEST_CHALLENGE_ACTION ||
        typeof proof["hostname"] !== "string" || !hosts.includes(proof["hostname"].toLowerCase()) ||
        !Number.isFinite(age) || age < -30000 || age > 300000) {
      throw new Error("invalid verification");
    }
  } catch {
    // Do not expose tokens, secrets or provider responses to the browser/logs.
    throw new Error(GUEST_CHALLENGE_MSG);
  }
}
