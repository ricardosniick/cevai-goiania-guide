import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ensurePlace, type PlaceSummary } from "@/lib/places.functions";
import { STALL_KINDS } from "@/lib/categories";
import { friendlyError } from "@/lib/errors";
import type { PlaceStat, Stall } from "@/components/cevai/types";
import { CeVaiRating, Field, ListError } from "@/components/cevai/shared";

export function StallsPanel({ place, user, onRegister, notify }: { place: PlaceSummary; user: User; onRegister: (s: Stall) => void; notify: (m: string) => void }) {
  const qc = useQueryClient();
  const stalls = useQuery({ queryKey: ["stalls", place.id], queryFn: async () => { const { data, error } = await supabase.from("fair_stalls").select("id, place_id, name, kind, emoji").eq("place_id", place.id).order("created_at"); if (error) throw error; return data as Stall[]; } });
  const ids = (stalls.data ?? []).map((x) => x.id);
  const stats = useQuery({ queryKey: ["stall-stats", ids.join(",")], enabled: ids.length > 0, queryFn: async () => { const { data, error } = await supabase.rpc("stall_experience_stats", { _stall_ids: ids }); if (error) throw error; const m: Record<string, PlaceStat> = {}; (data ?? []).forEach((r) => { m[r.stall_id] = { avg: Number(r.avg_rating), count: Number(r.experience_count) }; }); return m; } });
  const [adding, setAdding] = useState(false); const [name, setName] = useState(""); const [kind, setKind] = useState(STALL_KINDS[0]!);
  const ensure = useServerFn(ensurePlace);
  const add = async () => {
    try {
      await ensure({ data: { placeId: place.id } });
      const { error } = await supabase.from("fair_stalls").insert({ place_id: place.id, name: name.trim(), kind: kind.kind, emoji: kind.emoji, created_by: user.id });
      if (error) return notify(friendlyError(error, "Não foi possível adicionar a barraquinha.", "fair_stalls"));
    } catch (e) { return notify(friendlyError(e, "Não foi possível adicionar a barraquinha.", "fair_stalls")); }
    setName(""); setAdding(false); notify("Barraquinha adicionada!"); void qc.invalidateQueries({ queryKey: ["stalls", place.id] });
  };
  return <div>
    <h2 className="font-display text-lg font-black">Barraquinhas desta feira</h2>
    <p className="mt-1 text-xs text-muted-foreground">Cadastradas pela comunidade do Cê vai — não vêm do Google. Cada barraquinha tem suas próprias experiências, separadas da nota da feira.</p>
    <div className="mt-4 space-y-2">
      {stalls.data?.map((st) => { const stat = stats.data?.[st.id]; return <div key={st.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-2xl">{st.emoji}</span>
        <div className="min-w-0 flex-1"><p className="truncate font-bold">{st.name}</p><p className="text-[10px] font-bold text-muted-foreground">{st.kind} · criado pela comunidade</p><CeVaiRating stat={stat} /></div>
        <Button size="sm" onClick={() => onRegister(st)} className="shrink-0 rounded-full bg-secondary text-xs font-extrabold text-secondary-foreground hover:bg-secondary/90">Eu fui</Button>
      </div>; })}
      {stalls.isError && <ListError onRetry={() => void stalls.refetch()} />}
      {stalls.data?.length === 0 && <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Nenhuma barraquinha cadastrada ainda.</p>}
    </div>
    {adding ? <div className="mt-4 space-y-3 rounded-2xl bg-card p-4 shadow-sm">
      <Field label="Nome da barraquinha" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Pastel da Dona Maria" />
      <div className="flex flex-wrap gap-2">{STALL_KINDS.map((k) => <button key={k.kind} onClick={() => setKind(k)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${kind.kind === k.kind ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{k.emoji} {k.kind}</button>)}</div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setAdding(false)} className="flex-1 rounded-full">Cancelar</Button><Button disabled={name.trim().length < 2} onClick={() => void add()} className="flex-1 rounded-full bg-primary font-extrabold text-primary-foreground">Adicionar</Button></div>
    </div> : <Button variant="outline" onClick={() => setAdding(true)} className="mt-4 h-11 w-full rounded-full border-dashed font-extrabold"><Plus size={16} />Adicionar barraquinha</Button>}
  </div>;
}
