import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared-link helpers: links look like `/?lugar=<googlePlaceId>`. */
export const PENDING_LINK_KEY = "cevai-pending-link";
const DISMISS_KEY = "cevai-install-dismissed";

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

/** Non-blocking install card. Shown on mobile browsers (never inside the installed app);
 *  after a shared link it waits a bit longer so the content opens first. */
export function InstallPrompt({ shared }: { shared: boolean }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua));
    const mobile = isIos || /android/i.test(ua);
    setIos(isIos);
    // Test helper: `?instalar=1` clears the saved "Continuar no navegador" choice and shows the card again.
    const url = new URL(window.location.href);
    if (url.searchParams.get("instalar") === "1") {
      localStorage.removeItem(DISMISS_KEY);
      url.searchParams.delete("instalar");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    const eligible = mobile && !isStandalone() && !dismissed;
    const delay = shared ? 4000 : 2500;
    let t: number | undefined;
    // iOS has no native prompt: show instructions after the delay.
    if (eligible && isIos) t = window.setTimeout(() => setOpen(true), delay);
    const w = window as unknown as { __cevaiBIP?: BIPEvent };
    const useEvent = (e: BIPEvent) => {
      setDeferred(e);
      if (eligible) { window.clearTimeout(t); t = window.setTimeout(() => setOpen(true), delay); }
    };
    // The event may have fired before hydration; the early script in the page head stores it.
    if (w.__cevaiBIP) useEvent(w.__cevaiBIP);
    const onPrompt = () => { if (w.__cevaiBIP) useEvent(w.__cevaiBIP); };
    const onInstalled = () => { setOpen(false); localStorage.setItem(DISMISS_KEY, "1"); w.__cevaiBIP = undefined; };
    window.addEventListener("cevai-bip", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("cevai-bip", onPrompt); window.removeEventListener("appinstalled", onInstalled); window.clearTimeout(t); };
  }, [shared]);

  const close = () => { localStorage.setItem(DISMISS_KEY, "1"); setOpen(false); };
  const install = async () => {
    if (!deferred) return close();
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  // Android/desktop without a native prompt available: nothing to offer.
  if (!open || (!ios && !deferred)) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[60] p-3 pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+5rem))]">
      <div role="dialog" aria-labelledby="install-title" className="pointer-events-auto animate-in slide-in-from-bottom fade-in rounded-2xl border border-border bg-background p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <img src="/icon-192.png" alt="" className="size-12 shrink-0 rounded-xl shadow" />
          <div className="min-w-0 flex-1">
            <h2 id="install-title" className="font-display text-base font-black">📲 Instale o Cê Vai?</h2>
            {ios ? (
              <p className="mt-0.5 text-sm text-muted-foreground">Toque em Compartilhar <Share size={14} className="inline -mt-0.5 text-primary" /> e depois em <b>Adicionar à Tela de Início</b>.</p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">Tenha o Cê Vai? na tela inicial para acessar seus lugares e experiências com mais facilidade.</p>
            )}
          </div>
          <button onClick={close} aria-label="Fechar" className="-mr-1 -mt-1 grid size-8 place-items-center rounded-full text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="ghost" onClick={close} className="h-10 flex-1 rounded-full text-sm font-bold">Continuar no navegador</Button>
          <Button onClick={() => (ios ? close() : void install())} className="h-10 flex-1 rounded-full text-sm font-extrabold">{ios ? "Entendi" : "Instalar Cê Vai?"}</Button>
        </div>
      </div>
    </div>
  );
}
