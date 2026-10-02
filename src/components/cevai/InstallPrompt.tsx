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

export function InstallPrompt({ shared }: { shared: boolean }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const mobile = /android|iphone|ipad|ipod/i.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua));
    const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua));
    setIos(isIos);
    const dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    const eligible = shared && mobile && !isStandalone() && !dismissed;
    if (eligible && isIos) setOpen(true);
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); if (eligible) setOpen(true); };
    const onInstalled = () => setOpen(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // Android without the native prompt yet: still offer it after a moment.
    const t = eligible && !isIos ? window.setTimeout(() => setOpen(true), 1200) : undefined;
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); window.clearTimeout(t); };
  }, [shared]);

  const close = () => { sessionStorage.setItem(DISMISS_KEY, "1"); setOpen(false); setIosHelp(false); };
  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setOpen(false);
      return;
    }
    setIosHelp(true);
  };

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-[60] flex items-end bg-foreground/40 animate-in fade-in" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <div className="w-full animate-in slide-in-from-bottom rounded-t-3xl bg-background p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="flex items-start gap-4">
          <img src="/icon-192.png" alt="" className="size-14 shrink-0 rounded-2xl shadow" />
          <div className="min-w-0 flex-1">
            <h2 id="install-title" className="font-display text-xl font-black">📲 Instale o Cê Vai?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tenha o Cê Vai? na tela inicial do seu celular e descubra, salve e registre lugares com facilidade.</p>
          </div>
          <button onClick={close} aria-label="Fechar" className="-mr-2 -mt-2 grid size-9 place-items-center rounded-full text-muted-foreground"><X size={18} /></button>
        </div>
        {iosHelp || (ios && !deferred) ? (
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm font-semibold">
            <p className="font-extrabold">Para instalar o Cê Vai?:</p>
            <p className="mt-2 flex items-center gap-1.5">1. Toque em Compartilhar <Share size={16} className="text-primary" /></p>
            <p className="mt-1">2. Toque em ‘Adicionar à Tela de Início’</p>
            {!ios && <p className="mt-2 text-xs font-medium text-muted-foreground">No Android, use o menu do navegador e escolha “Instalar app”.</p>}
          </div>
        ) : (
          <Button onClick={() => void install()} className="mt-5 h-12 w-full rounded-full text-base font-extrabold">Instalar Cê Vai?</Button>
        )}
        <Button variant="ghost" onClick={close} className="mt-2 h-11 w-full rounded-full font-bold">Continuar no navegador</Button>
      </div>
    </div>
  );
}
