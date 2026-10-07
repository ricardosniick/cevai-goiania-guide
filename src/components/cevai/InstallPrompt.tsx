import { useEffect, useRef, useState } from "react";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared-link helpers: links look like `/?lugar=<googlePlaceId>`. */
export const PENDING_LINK_KEY = "cevai-pending-link";
// v2: resets choices saved during earlier testing; forced test mode never saves a choice.
const DISMISS_KEY = "cevai-install-dismissed-v2";

export function shareUrlFor(placeId: string) {
  return `${window.location.origin}/?lugar=${encodeURIComponent(placeId)}`;
}

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** Reads `?lugar=` from the URL, stores it (so it survives install/login) and cleans the URL. */
export function captureSharedLink(): string | null {
  const url = new URL(window.location.href);
  const id = url.searchParams.get("lugar");
  if (id) {
    localStorage.setItem(PENDING_LINK_KEY, id);
    url.searchParams.delete("lugar");
    // iOS installs the current URL, so keep it on iOS; elsewhere clean it.
    if (!/iphone|ipad|ipod/i.test(navigator.userAgent)) window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
  return id;
}

export function takePendingLink(): string | null {
  const id = localStorage.getItem(PENDING_LINK_KEY);
  if (id) localStorage.removeItem(PENDING_LINK_KEY);
  return id;
}

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Install sheet shown on mobile browsers before sign-up/login (never inside the installed app).
 *  Uses Chrome's native prompt when available; otherwise shows the app's own instructions.
 *  `?instalar=1` forces it again even after "Continuar no navegador". */
export function InstallPrompt({ shared }: { shared: boolean }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);
  const forcedRef = useRef(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua));
    const mobile = isIos || /android|mobile/i.test(ua);
    setIos(isIos);
    const url = new URL(window.location.href);
    const forced = url.searchParams.get("instalar") === "1";
    forcedRef.current = forced;
    if (forced) {
      url.searchParams.delete("instalar");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    const eligible = !isStandalone() && (forced || (mobile && !dismissed));
    // Shared links: let the content open first, then offer installation.
    const t = eligible ? window.setTimeout(() => setOpen(true), shared ? 3000 : 600) : undefined;
    const w = window as unknown as { __cevaiBIP?: BIPEvent | undefined };
    // The event may have fired before hydration; the early script in the page head stores it.
    if (w.__cevaiBIP) setDeferred(w.__cevaiBIP);
    const onPrompt = () => { if (w.__cevaiBIP) setDeferred(w.__cevaiBIP); };
    const onInstalled = () => { setOpen(false); localStorage.setItem(DISMISS_KEY, "1"); w.__cevaiBIP = undefined; };
    window.addEventListener("cevai-bip", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("cevai-bip", onPrompt); window.removeEventListener("appinstalled", onInstalled); window.clearTimeout(t); };
  }, [shared]);

  const close = () => { if (!forcedRef.current) localStorage.setItem(DISMISS_KEY, "1"); setOpen(false); setHelp(false); };
  const install = async () => {
    // No native prompt from the browser: show the Android menu instructions instead.
    if (!deferred) { setHelp(true); return; }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    (window as unknown as { __cevaiBIP?: BIPEvent | undefined }).__cevaiBIP = undefined;
    if (choice.outcome === "accepted") { localStorage.setItem(DISMISS_KEY, "1"); setOpen(false); }
    else setHelp(true);
  };

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-[60] flex items-end bg-foreground/40 animate-in fade-in" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <div className="w-full animate-in slide-in-from-bottom rounded-t-3xl bg-background p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="flex items-start gap-4">
          <img src="/icon-192.png" alt="" className="size-14 shrink-0 rounded-2xl shadow" />
          <div className="min-w-0 flex-1">
            <h2 id="install-title" className="font-display text-xl font-black">{ios ? "📲 Adicione o Cê vai à sua tela inicial" : "📲 Tenha o Cê vai no seu celular"}</h2>
            {!ios && <p className="mt-1 text-sm text-muted-foreground">Instale o Cê vai para acessar seus lugares, experiências e descobertas de forma rápida.</p>}
          </div>
        </div>
        {ios ? (
          <ol className="mt-5 space-y-1.5 rounded-2xl bg-muted p-4 text-sm font-semibold">
            <li className="flex items-center gap-1.5">1. Toque em Compartilhar <Share size={16} className="text-primary" /></li>
            <li>2. Toque em ‘Adicionar à Tela de Início’</li>
            <li>3. Toque em ‘Adicionar’</li>
          </ol>
        ) : help ? (
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm font-semibold">
            Toque nos <b>⋮</b> do Chrome e escolha <b>‘Instalar app’</b> ou <b>‘Adicionar à tela inicial’</b>.
          </div>
        ) : (
          <Button onClick={() => void install()} className="mt-5 h-12 w-full rounded-full text-base font-extrabold">Instalar Cê vai</Button>
        )}
        <Button variant="ghost" onClick={close} className="mt-2 h-11 w-full rounded-full font-bold">Continuar no navegador</Button>
      </div>
    </div>
  );
}
