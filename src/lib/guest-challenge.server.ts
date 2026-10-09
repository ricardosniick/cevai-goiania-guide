import { GUEST_CHALLENGE_ACTION, GUEST_CHALLENGE_MSG } from "./guest-challenge";

type FailureCode = "TS01" | "TS02" | "TS03" | "TS04" | "TS05" | "TS06" | "TS07" | "TS08" | "TS09" | "TS10" | "TS11" | "TS12" | "TS13" | "TS14" | "TS15" | "TS16" | "TS17" | "TS18" | "TS19" | "TS20";
const REASONS: Record<FailureCode, string> = {
  TS01: "missing_secret", TS02: "missing_hostnames", TS03: "invalid_hostnames_config",
  TS04: "invalid_token_input", TS05: "provider_http_error", TS06: "provider_network_error",
  TS07: "provider_invalid_json", TS08: "provider_invalid_response", TS09: "provider_rejected_secret",
  TS10: "expired_or_replayed_token", TS11: "provider_rejected_token", TS12: "provider_rejected_challenge",
  TS13: "action_mismatch", TS14: "hostname_mismatch", TS15: "invalid_token_timestamp",
  TS16: "provider_timeout", TS17: "provider_dns_error", TS18: "provider_tls_error",
  TS19: "provider_network_denied", TS20: "unsupported_server_runtime",
};

function deny(code: FailureCode): never {
  // Only a fixed classification is logged: no token, secret, hostname list or raw provider response.
  console.error("[guest-challenge]", code, REASONS[code]);
  throw new Error(`${GUEST_CHALLENGE_MSG} [${code}]`);
}

/** Classify only recognized names/codes; never stringify exceptions or copy their messages. */
function transportFailure(error: unknown, timedOut: boolean): FailureCode {
  if (timedOut) return "TS16";
  let current = error;
  for (let depth = 0; depth < 4; depth++) {
    if (!current || typeof current !== "object") break;
    const value = current as Record<string, unknown>;
    const code = value["code"];
    if (value["name"] === "TimeoutError" || code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") return "TS16";
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "TS17";
    if (code === "CERT_HAS_EXPIRED" || code === "DEPTH_ZERO_SELF_SIGNED_CERT" || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || code === "ERR_TLS_CERT_ALTNAME_INVALID") return "TS18";
    if (code === "EACCES" || code === "EPERM") return "TS19";
    current = value["cause"];
  }
  return "TS06";
}

async function siteverify(secret: string, token: string): Promise<unknown> {
  if (typeof fetch !== "function" || typeof AbortController !== "function") deny("TS20");
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 8000);
  try {
    let response: Response;
    try {
      response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST", redirect: "error", signal: controller.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token }),
      });
    } catch (error) { deny(transportFailure(error, timedOut)); }
    if (!response.ok) deny("TS05");
    try { return await response.json(); }
    catch (error) {
      if (error instanceof SyntaxError) deny("TS07");
      deny(transportFailure(error, timedOut));
    }
  } finally { clearTimeout(timer); }
}

/** Verify every guest request with Cloudflare; tokens are single-use, never cached. */
export async function verifyGuestChallenge(token: unknown): Promise<void> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  const hosts = (process.env["TURNSTILE_ALLOWED_HOSTNAMES"] ?? "").split(",").map(h => h.trim().toLowerCase()).filter(Boolean);
  if (!secret) deny("TS01");
  if (!hosts.length) deny("TS02");
  if (hosts.some(h => !/^[a-z0-9.-]+$/.test(h))) deny("TS03");
  if (typeof token !== "string" || !token.trim() || token.length > 2048) deny("TS04");
  const result = await siteverify(secret, token);
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
