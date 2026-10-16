import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Compass, Loader2, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recommendPlaces, type Recommendation } from "@/lib/ai-recommend.functions";
import { WISH_MAX } from "@/lib/ai-recommend";
import type { LatLng } from "@/components/cevai/types";
import { PlacePhoto } from "@/components/cevai/shared";

const WISH_EXAMPLES = ["café tranquilo para trabalhar", "feira hoje", "quadra de tênis"];

export function AssistantPanel({ center, onOpen }: { center: LatLng; onOpen: (id: string) => void }) {
  const recommend = useServerFn(recommendPlaces);
  const [open, setOpen] = useState(false);
  const [wish, setWish] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Recommendation[] | null>(null);

  async function ask() {
    const w = wish.trim();
    if (w.length < 3 || loading) return;
    setLoading(true); setError(null); setResults(null);
    try { setResults(await recommend({ data: { wish: w, lat: center.lat, lng: center.lng } })); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível falar com o assistente."); }
    finally { setLoading(false); }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mx-5 mt-4 flex w-[calc(100%-2.5rem)] items-center gap-3 rounded-2xl bg-primary px-3 py-3 text-left text-primary-foreground shadow-sm transition active:scale-[0.97]">
    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground"><Compass size={16} /></span>
    <span className="min-w-0 flex-1"><span className="block font-display text-sm font-black">Não sabe aonde ir?</span><span className="mt-0.5 block text-[11px] leading-snug text-primary-foreground/80">Encontre um lugar que combine com você.</span></span>
    <ChevronRight size={18} aria-hidden="true" className="shrink-0" />
  </button>;

  return <div className="mx-5 mt-4 rounded-2xl bg-card p-4 shadow-sm">
    <div className="flex items-center justify-between"><p className="flex items-center gap-2 font-display font-black"><Compass size={18} className="text-primary" />Me ajuda a escolher</p><button aria-label="Fechar assistente" onClick={() => setOpen(false)}><X size={18} className="text-muted-foreground" /></button></div>
    <form onSubmit={(e) => { e.preventDefault(); void ask(); }} className="mt-3 space-y-3">
      <textarea value={wish} maxLength={WISH_MAX} onChange={(e) => setWish(e.target.value)} rows={2} autoFocus aria-label="O que você procura" placeholder="Ex.: café tranquilo para trabalhar à tarde" className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      <div className="flex flex-wrap gap-1.5" aria-label="Sugestões de busca">{WISH_EXAMPLES.map((ex) => <button key={ex} type="button" disabled={loading} onClick={() => setWish(ex)} className="max-w-full rounded-full bg-muted px-2.5 py-1.5 text-left text-[11px] font-bold transition active:scale-[0.97] disabled:opacity-50">{ex}</button>)}</div>
      <Button type="submit" disabled={loading || wish.trim().length < 3} className="h-11 w-full rounded-full font-extrabold">{loading ? <><Loader2 className="animate-spin" />Procurando…</> : "Pedir sugestões"}</Button>
    </form>
    {error && <p className="mt-3 rounded-xl bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {results && results.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Não achei nada que combine. Tente descrever de outro jeito.</p>}
    {results && results.length > 0 && <div className="mt-3 space-y-2">
      {results.map(({ place, reason }) => <button key={place.id} onClick={() => onOpen(place.id)} className="flex w-full items-center gap-3 rounded-xl bg-background p-2 text-left transition active:scale-[0.97]">
        <PlacePhoto src={place.photoUrl} alt={place.name} className="size-16 shrink-0 rounded-lg" />
        <div className="min-w-0"><p className="truncate font-bold">{place.name}</p><p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground"><MapPin size={11} />{place.category}</p>{reason && <p className="mt-0.5 line-clamp-2 text-xs text-foreground/80">{reason}</p>}</div>
      </button>)}
      <p className="text-center text-[10px] text-muted-foreground">Sugestões geradas por IA a partir de dados do Google Maps</p>
    </div>}
  </div>;
}
