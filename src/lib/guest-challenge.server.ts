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

type Detail = { stage: string; error?: unknown; status?: number; provider?: unknown };
// Values removed from every logged string (secret and current token).
const sensitive: string[] = [];
function redact(text: string): string {
  let out = text;
  for (const v of sensitive) if (v) out = out.split(v).join("[redacted]");
  return out.slice(0, 300);
}
function describeError(error: unknown): { name: string; message: string } {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return { name: redact(String(e["name"] ?? "Error")), message: redact(typeof e["message"] === "string" ? e["message"] : "") };
  }
  return { name: typeof error, message: "" };
}
function providerSummary(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { shape: Array.isArray(body) ? "array" : typeof body };
  const b = body as Record<string, unknown>;
  const codes = Array.isArray(b["error-codes"]) ? b["error-codes"].filter(c => typeof c === "string").map(c => redact(c as string)) : undefined;
  return { success: typeof b["success"] === "boolean" ? b["success"] : typeof b["success"], "error-codes": codes };
}

function deny(code: FailureCode, detail?: Detail): never {
  // Logs stage, exception name/message (redacted), HTTP status and only success/error-codes.
  // Never logs secret, token, headers, request body or hostname list.
  const log: Record<string, unknown> = { reason: REASONS[code] };
  if (detail) {
    log["stage"] = detail.stage;
    if (detail.error !== undefined) log["error"] = describeError(detail.error);
    if (detail.status !== undefined) log["status"] = detail.status;
    if (detail.provider !== undefined) log["provider"] = providerSummary(detail.provider);
  }
  console.error("[guest-challenge]", code, JSON.stringify(log));
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
  if (typeof fetch !== "function" || typeof AbortController !== "function") deny("TS20", { stage: "runtime" });
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 8000);
  try {
    let response: Response;
    try {
      response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST", redirect: "manual", signal: controller.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token }),
      });
    } catch (error) { deny(transportFailure(error, timedOut), { stage: "siteverify_fetch", error }); }
    // Never follow redirects: any 3xx is rejected outright.
    if (response.status >= 300 && response.status < 400) deny("TS05", { stage: "siteverify_redirect", status: response.status });
    if (!response.ok) deny("TS05", { stage: "siteverify_http", status: response.status });
    try { return await response.json(); }
    catch (error) {
      if (error instanceof SyntaxError) deny("TS07", { stage: "siteverify_json", error, status: response.status });
      deny(transportFailure(error, timedOut), { stage: "siteverify_body", error, status: response.status });
    }
  } finally { clearTimeout(timer); }
}

/** Verify every guest request with Cloudflare; tokens are single-use, never cached. */
export async function verifyGuestChallenge(token: unknown): Promise<void> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  const hosts = (process.env["TURNSTILE_ALLOWED_HOSTNAMES"] ?? "").split(",").map(h => h.trim().toLowerCase()).filter(Boolean);
  sensitive.length = 0;
  if (secret) sensitive.push(secret);
  if (typeof token === "string" && token) sensitive.push(token);
  if (!secret) deny("TS01", { stage: "config" });
  if (!hosts.length) deny("TS02", { stage: "config" });
  if (hosts.some(h => !/^[a-z0-9.-]+$/.test(h))) deny("TS03", { stage: "config" });
  if (typeof token !== "string" || !token.trim() || token.length > 2048) deny("TS04", { stage: "input" });
  const result = await siteverify(secret, token);
  if (!result || typeof result !== "object" || Array.isArray(result)) deny("TS08", { stage: "response_shape", provider: result });
  const proof = result as Record<string, unknown>;
  if (proof["success"] !== true) {
    const d = { stage: "provider_rejected", status: 200, provider: proof };
    if (proof["success"] !== false) deny("TS08", { ...d, stage: "response_shape" });
    const codes = Array.isArray(proof["error-codes"]) ? proof["error-codes"] : [];
    if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) deny("TS09", d);
    if (codes.includes("timeout-or-duplicate")) deny("TS10", d);
    if (codes.includes("invalid-input-response") || codes.includes("missing-input-response")) deny("TS11", d);
    deny("TS12", d);
  }
  if (proof["action"] !== GUEST_CHALLENGE_ACTION) deny("TS13", { stage: "claims", status: 200, provider: proof });
  if (typeof proof["hostname"] !== "string" || !hosts.includes(proof["hostname"].toLowerCase())) deny("TS14", { stage: "claims", status: 200, provider: proof });
  const timestamp = typeof proof["challenge_ts"] === "string" ? Date.parse(proof["challenge_ts"]) : NaN;
  const age = Date.now() - timestamp;
  if (!Number.isFinite(age) || age < -30000 || age > 300000) deny("TS15", { stage: "claims", status: 200, provider: proof });
}
