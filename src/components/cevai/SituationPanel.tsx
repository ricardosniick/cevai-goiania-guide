import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { Check, Flag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { postSituation, type PlaceSummary } from "@/lib/places.functions";
import { SITUATION_OPTIONS, situationKind, situationRadius } from "@/lib/categories";

type Pos = { lat: number; lng: number; accuracy: number };
const meters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000, r = (x: number) => (x * Math.PI) / 180;
  return 2 * R * Math.asin(Math.sqrt(Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2));
};

export function updatedAgo(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 2) return "Atualizado agora";
  if (min < 60) return `Atualizado há ${min} min`;
  return `Atualizado há ${Math.floor(min / 60)}h`;
}

export type SituationNow = { place_id: string; situation_id: string | null; situations: string[] | null; updated_at: string | null; expires_at: string | null; people_here: number };

/** Current, non-expired situations for a set of places (shared by detail page and map). */
export function useSituations(user: User | null, ids: string[]) {
  return useQuery({
    enabled: !!user && ids.length > 0,
    queryKey: ["situations", ids.join(",")],
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("place_situation_now", { _place_ids: ids });
      if (error) throw error;
      const now = Date.now();
      return Object.fromEntries((data ?? []).map((r) => [r.place_id, r.expires_at && new Date(r.expires_at).getTime() > now ? r : { ...r, situation_id: null, situations: null, updated_at: null }])) as Record<string, SituationNow>;
    },
  });
}

export function SituationPanel({ user, place, notify }: { user: User; place: PlaceSummary; notify: (m: string) => void }) {
  const kind = situationKind(place.category, `${place.name} ${place.typeLabel}`);
  const qc = useQueryClient();
  const post = useServerFn(postSituation);
  const sit = useSituations(user, [place.id]);
  const cur = sit.data?.[place.id];
  const [pos, setPos] = useState<Pos | null>(null);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 60000); return () => window.clearInterval(t); }, []);
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition((p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }), () => setPos(null), { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  if (!kind) return null;
  // Approximate on the device; the server re-checks against Google's location.
  const radius = place.category === "Parques" ? 1500 : situationRadius(place.category);
  const onSite = !!pos && pos.accuracy <= 150 && meters(pos, place) <= radius + Math.min(pos.accuracy, 50);
  const options = SITUATION_OPTIONS[kind];

  const publish = async () => {
    if (!pos || !picked.length) return;
    setBusy(true);
    try {
      await post({ data: { placeId: place.id, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, situations: picked } });
      setOpen(false); setPicked([]);
      void qc.invalidateQueries({ queryKey: ["situations"] });
      notify("Situação atualizada ✓");
    } catch (e) { notify(e instanceof Error ? e.message : "Algo deu errado."); }
    finally { setBusy(false); }
  };
  const report = async () => {
    if (!cur?.situation_id) return;
    const { error } = await supabase.from("situation_reports").insert({ situation_id: cur.situation_id, reporter: user.id });
    notify(error ? "Você já denunciou esta situação." : "Denúncia enviada. Obrigado!");
  };
  const toggle = (o: string) => setPicked((p) => (p.includes(o) ? p.filter((x) => x !== o) : p.length >= 4 ? p : [...p, o]));

  return (
    <section className="rounded-2xl bg-card p-4 shadow-sm">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-secondary">📍 Situação agora</p>
      {cur?.situations?.length && cur.updated_at ? (
        <>
          <div className="mt-2 flex flex-wrap gap-2">{cur.situations.map((s) => <span key={s} className="rounded-full bg-muted px-3 py-1.5 text-sm font-bold">{s}</span>)}</div>
          <div className="mt-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>{updatedAgo(cur.updated_at)} · por alguém no local</span>
            <button onClick={() => void report()} aria-label="Denunciar situação" className="flex items-center gap-1"><Flag size={12} />Denunciar</button>
          </div>
        </>
      ) : sit.isLoading ? <p className="mt-2 text-sm text-muted-foreground">Carregando…</p> : <p className="mt-2 text-sm text-muted-foreground">Sem informações recentes sobre a situação deste local.</p>}
      {!!cur?.people_here && <p className="mt-2 text-sm font-bold">👥 {cur.people_here} {cur.people_here === 1 ? "pessoa está" : "pessoas estão"} aqui agora</p>}

      {onSite && !open && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="font-display font-black">📍 Como está agora?</p>
          <Button onClick={() => setOpen(true)} className="mt-2 h-11 w-full rounded-full font-extrabold">Atualizar situação</Button>
        </div>
      )}
      {onSite && open && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center justify-between"><p className="font-display font-black">📍 Como está agora?</p><button aria-label="Fechar" onClick={() => { setOpen(false); setPicked([]); }} className="text-muted-foreground"><X size={18} /></button></div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {options.map((o) => { const on = picked.includes(o); return (
              <button key={o} onClick={() => toggle(o)} aria-pressed={on} className={`flex min-h-12 items-center gap-1.5 rounded-2xl border px-3 py-2 text-left text-sm font-bold transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>{on && <Check size={14} className="shrink-0" />}{o}</button>
            ); })}
          </div>
          <Button disabled={!picked.length || busy} onClick={() => void publish()} className="mt-3 h-11 w-full rounded-full bg-secondary font-extrabold text-secondary-foreground">{busy ? "Publicando…" : "Publicar situação"}</Button>
        </div>
      )}
    </section>
  );
}
