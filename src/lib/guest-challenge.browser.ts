import { GUEST_CHALLENGE_ACTION, GUEST_CHALLENGE_MSG } from "./guest-challenge";

type WidgetOptions = {
  sitekey: string; action: string; execution: "execute"; appearance: "interaction-only";
  retry: "never"; callback: (token: string) => void;
  "error-callback": () => void; "expired-callback": () => void; "timeout-callback": () => void;
};
type Turnstile = { render: (container: HTMLElement, options: WidgetOptions) => string; execute: (id: string) => void; remove: (id: string) => void };
declare global { interface Window { turnstile?: Turnstile } }
let loading: Promise<Turnstile> | null = null;

function loadWidget(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(fail, 15000);
    function fail() { window.clearTimeout(timer); script.remove(); reject(new Error(GUEST_CHALLENGE_MSG)); }
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => { window.clearTimeout(timer); if (window.turnstile) resolve(window.turnstile); else fail(); };
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch(error => { loading = null; throw error; });
  return loading;
}

/** Public site key only. The private key must stay in the server's secrets. */
export const DEFAULT_TURNSTILE_SITE_KEY = "0x4AAAAAAFST2lM6mrSDqNSA";

export function resolveTurnstileSiteKey(envValue: unknown): string {
  return typeof envValue === "string" && envValue.trim() ? envValue.trim() : DEFAULT_TURNSTILE_SITE_KEY;
}

/** A separate widget/token for each request, including concurrent requests. Never reuse a token. */
export async function getGuestChallengeToken(signal?: AbortSignal): Promise<string> {
  const sitekey = resolveTurnstileSiteKey(import.meta.env["VITE_TURNSTILE_SITE_KEY"]);
  if (!sitekey || typeof window === "undefined" || signal?.aborted) throw new Error(GUEST_CHALLENGE_MSG);
  const api = await loadWidget();
  if (signal?.aborted) throw new Error(GUEST_CHALLENGE_MSG);
  return new Promise<string>((resolve, reject) => {
    const container = document.createElement("div");
    container.setAttribute("aria-label", "Verificação de segurança");
    // The managed challenge stays visible when interaction is necessary; no changes to app layout.
    let host = document.getElementById("cevai-guest-verification");
    if (!host) {
      host = document.createElement("div"); host.id = "cevai-guest-verification";
      Object.assign(host.style, { position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", zIndex: "10000", display: "flex", flexDirection: "column", maxHeight: "70vh", overflowY: "auto" });
      document.body.appendChild(host);
    }
    host.appendChild(container);
    const widgetHost = host;
    let id: string | undefined;
    let settled = false;
    const timer = window.setTimeout(fail, 120000);
    function finish(token?: string) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer); signal?.removeEventListener("abort", fail);
      if (id !== undefined) { try { api.remove(id); } catch { /* Always settle and remove our DOM even if the provider failed. */ } }
      container.remove();
      if (!widgetHost.hasChildNodes()) widgetHost.remove();
      if (token && token.length <= 2048) resolve(token); else reject(new Error(GUEST_CHALLENGE_MSG));
    }
    function fail() { finish(); }
    signal?.addEventListener("abort", fail, { once: true });
    try {
      id = api.render(container, {
        sitekey, action: GUEST_CHALLENGE_ACTION, execution: "execute", appearance: "interaction-only", retry: "never",
        callback: token => finish(token), "error-callback": fail, "expired-callback": fail, "timeout-callback": fail,
      });
      if (settled) api.remove(id); else api.execute(id);
    } catch { fail(); }
  });
}
