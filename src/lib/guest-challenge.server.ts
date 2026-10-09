import { GUEST_CHALLENGE_ACTION, GUEST_CHALLENGE_MSG } from "./guest-challenge";

type FailureCode = "TS01" | "TS02" | "TS03" | "TS04" | "TS05" | "TS06" | "TS07" | "TS08" | "TS09" | "TS10" | "TS11" | "TS12" | "TS13" | "TS14" | "TS15";
const REASONS: Record<FailureCode, string> = {
  TS01: "missing_secret", TS02: "missing_hostnames", TS03: "invalid_hostnames_config",
  TS04: "invalid_token_input", TS05: "provider_http_error", TS06: "provider_network_error",
  TS07: "provider_invalid_json", TS08: "provider_invalid_response", TS09: "provider_rejected_secret",
  TS10: "expired_or_replayed_token", TS11: "provider_rejected_token", TS12: "provider_rejected_challenge",
  TS13: "action_mismatch", TS14: "hostname_mismatch", TS15: "invalid_token_timestamp",
};

function deny(code: FailureCode): never {
  // Only a fixed classification is logged: no token, secret, hostname list or raw provider response.
  console.error("[guest-challenge]", code, REASONS[code]);
  throw new Error(`${GUEST_CHALLENGE_MSG} [${code}]`);
}

/** Verify every guest request with Cloudflare; tokens are single-use, never cached. */
export async function verifyGuestChallenge(token: unknown): Promise<void> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  const hosts = (process.env["TURNSTILE_ALLOWED_HOSTNAMES"] ?? "").split(",").map(h => h.trim().toLowerCase()).filter(Boolean);
  if (!secret) deny("TS01");
  if (!hosts.length) deny("TS02");
  if (hosts.some(h => !/^[a-z0-9.-]+$/.test(h))) deny("TS03");
  if (typeof token !== "string" || !token.trim() || token.length > 2048) deny("TS04");
  let response: Response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
  } catch { deny("TS06"); }
  if (!response.ok) deny("TS05");
  let result: unknown;
  try { result = await response.json(); } catch { deny("TS07"); }
  if (!result || typeof result !== "object" || Array.isArray(result)) deny("TS08");
  const proof = result as Record<string, unknown>;
  if (proof["success"] !== true) {
    if (proof["success"] !== false) deny("TS08");
    const codes = Array.isArray(proof["error-codes"]) ? proof["error-codes"] : [];
    if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) deny("TS09");
    if (codes.includes("timeout-or-duplicate")) deny("TS10");
    if (codes.includes("invalid-input-response") || codes.includes("missing-input-response")) deny("TS11");
    deny("TS12");
  }
  if (proof["action"] !== GUEST_CHALLENGE_ACTION) deny("TS13");
  if (typeof proof["hostname"] !== "string" || !hosts.includes(proof["hostname"].toLowerCase())) deny("TS14");
  const timestamp = typeof proof["challenge_ts"] === "string" ? Date.parse(proof["challenge_ts"]) : NaN;
  const age = Date.now() - timestamp;
  if (!Number.isFinite(age) || age < -30000 || age > 300000) deny("TS15");
}
