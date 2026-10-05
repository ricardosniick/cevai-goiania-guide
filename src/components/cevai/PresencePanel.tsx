import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { Flag, Lock, MapPin, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { friendlyError, isNetworkError, OFFLINE_MSG } from "@/lib/errors";
import { supabase } from "@/integrations/supabase/client";
import { startPresence, type PlaceSummary } from "@/lib/places.functions";
import { presenceInterests, presenceRadius } from "@/lib/categories";

type Mode = "meet" | "appear" | "invisible";
type Pos = { lat: number; lng: number; accuracy: number };

function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
}

const MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: "meet", label: "🟢 Quero conhecer pessoas", hint: "Você aparece com seus interesses e pode receber pedidos de conexão." },
  { mode: "appear", label: "👀 Só quero aparecer", hint: "Seu primeiro nome aparece, sem receber pedidos." },
  { mode: "invisible", label: "🔒 Ficar invisível", hint: "Ninguém vê você." },
];

const errMsg = (e: unknown) => (isNetworkError(e) ? (console.error("[erro] presença", e), OFFLINE_MSG) : e instanceof Error ? e.message : "Algo deu errado.");

export function PresencePanel({ user, place, notify }: { user: User; place: PlaceSummary; notify: (m: string) => void }) {
  const qc = useQueryClient();
  const start = useServerFn(startPresence);
  const [pos, setPos] = useState<Pos | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [mode, setMode] = useState<Mode>("invisible");
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const radiusRef = useRef(presenceRadius(place.category));

  const mine = useQuery({ queryKey: ["presence", "mine", user.id], refetchInterval: 60000, queryFn: async () => {
    const { data } = await supabase.from("place_presence").select("place_id, mode, interests, expires_at").eq("user_id", user.id).maybeSingle();
    return data && new Date(data.expires_at) > new Date() ? data : null;
  } });
  const here = mine.data?.place_id === place.id ? mine.data : null;

  const people = useQuery({ enabled: !!here, queryKey: ["presence", "people", place.id], refetchInterval: 15000, queryFn: async () => {
    const { data, error } = await supabase.rpc("place_people_v2", { _place_id: place.id }); if (error) throw error; return data ?? [];
  } });
  const conns = useQuery({ enabled: !!here, queryKey: ["presence", "conns", place.id], refetchInterval: 8000, queryFn: async () => {
    const { data, error } = await supabase.rpc("my_connections", { _place_id: place.id }); if (error) throw error; return data ?? [];
  } });

  // Watch the device location while this place is open.
  useEffect(() => {
    if (!("geolocation" in navigator)) { setGeoError("Seu aparelho não informa a localização."); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => { setGeoError(null); setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); },
      () => setGeoError("Ative a localização para confirmar que você está no local."),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const dist = pos ? meters(pos, place) : null;
  const radius = radiusRef.current;
  const inArea = dist !== null && pos !== null && pos.accuracy <= 150 && dist <= radius + Math.min(pos.accuracy, 50);

  const refresh = () => { void qc.invalidateQueries({ queryKey: ["presence"] }); };
  const end = async (msg = "Presença encerrada.") => {
    try {
      const { error } = await supabase.rpc("end_presence");
      if (error) return notify(friendlyError(error, "Não foi possível encerrar a presença.", "end_presence"));
      setChatId(null); refresh(); notify(msg);
    } catch (e) { notify(friendlyError(e, "Não foi possível encerrar a presença.", "end_presence")); }
  };

  // Leaving the area ends presence (and its connections).
  const leftRef = useRef(false);
  useEffect(() => {
    if (!here || !pos || dist === null) { leftRef.current = false; return; }
    if (dist > radius * 1.5 + Math.min(pos.accuracy, 50) && !leftRef.current) { leftRef.current = true; void end("Você saiu do local. Presença encerrada."); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here, dist]);

  const confirm = async () => {
    if (!pos) return;
    setBusy(true);
    try {
      const r = await start({ data: { placeId: place.id, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, mode, interests } });
      radiusRef.current = Math.max(radiusRef.current, r.radius);
      setChoosing(false); refresh(); notify(mode === "invisible" ? "Presença marcada, invisível." : "Você está aqui!");
    } catch (e) { notify(errMsg(e)); } finally { setBusy(false); }
  };

  const rpc = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    let error: { message: string } | null;
    try { ({ error } = await fn()); } catch (e) { notify(friendlyError(e, "Não foi possível concluir.", "connection rpc")); return; }
    if (error) console.error("[erro] connection rpc", error);
    if (error && isNetworkError(error)) notify(OFFLINE_MSG);
    else if (error) notify(error.message.includes("already") ? "Você já enviou um pedido para essa pessoa nesta presença." : error.message.includes("not_open") ? "Essa pessoa não está aberta a conexões." : "Não foi possível concluir.");
    else notify(ok);
    refresh();
  };
  const report = async (id: string) => {
    const reason = window.prompt("Conte o que aconteceu (opcional):") ?? "";
    try {
      const r1 = await supabase.from("user_reports").insert({ reporter: user.id, reported: id, place_id: place.id, reason: reason.slice(0, 500) || "Sem detalhes" });
      const r2 = await supabase.from("user_blocks").upsert({ blocker: user.id, blocked: id });
      refresh();
      if (r1.error || r2.error) return notify(friendlyError(r1.error ?? r2.error, r2.error ? "Não foi possível bloquear. Tente de novo." : "Não foi possível enviar a denúncia. Tente de novo.", "report/block"));
      notify("Denúncia enviada. Essa pessoa foi bloqueada.");
    } catch (e) { notify(friendlyError(e, "Não foi possível enviar a denúncia. Tente de novo.", "report/block")); }
  };

  const options = presenceInterests(place.category);
  const myInterests = new Set(here?.interests ?? []);
  const others = (people.data ?? []).filter((x) => !x.is_me);
  const connOf = (id: string) => (conns.data ?? []).find((c) => c.other_id === id);
  const incoming = (conns.data ?? []).filter((c) => c.incoming && c.status === "pending");
  const chat = (conns.data ?? []).find((c) => c.id === chatId && c.status === "accepted");

  return <div className="mt-4 rounded-2xl bg-card p-4 shadow-sm">
    {here ? <div className="flex items-center justify-between gap-3">
      <div className="min-w-0"><p className="font-display font-black text-primary">📍 Você está aqui</p><p className="text-xs text-muted-foreground">{MODES.find((m) => m.mode === here.mode)?.label ?? ""} · termina sozinho em até 3h</p></div>
      <Button variant="outline" className="shrink-0 rounded-full" onClick={() => void end()}>Encerrar</Button>
    </div> : !inArea ? <div>
      <p className="font-display font-black text-primary">👥 Pessoas aqui agora</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Lock size={14} className="shrink-0" />Este recurso está disponível quando você estiver no local.</p>
      {geoError && <p className="mt-1 text-[11px] text-muted-foreground">{geoError}</p>}
    </div> : !choosing ? <div className="flex items-center justify-between gap-3">
      <p className="font-display font-black text-primary">Você está aqui?</p>
      <Button className="rounded-full" onClick={() => { setMode("invisible"); setInterests([]); setChoosing(true); }}><MapPin size={16} />Estou aqui</Button>
    </div> : <div className="space-y-3">
      <p className="font-display font-black text-primary">Como você quer aparecer?</p>
      <div className="space-y-2">{MODES.map((m) => <button key={m.mode} onClick={() => setMode(m.mode)} className={`w-full rounded-2xl border p-3 text-left ${mode === m.mode ? "border-primary bg-primary/10" : "border-border"}`}><p className="text-sm font-bold">{m.label}</p><p className="text-[11px] text-muted-foreground">{m.hint}</p></button>)}</div>
      {mode === "meet" && <div><p className="text-[11px] font-bold text-muted-foreground">Seus interesses aqui</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{options.map((s) => { const on = interests.includes(s); return <button key={s} onClick={() => setInterests(on ? interests.filter((x) => x !== s) : [...interests, s])} className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${on ? "border-secondary bg-secondary/15 text-secondary" : "border-border"}`}>{s}</button>; })}</div></div>}
      <p className="text-[10px] text-muted-foreground">Mostramos só seu primeiro nome e interesses — nunca sua posição, mesa ou distância.</p>
      <div className="flex gap-2"><Button variant="ghost" className="flex-1 rounded-full" onClick={() => setChoosing(false)}>Cancelar</Button><Button disabled={busy || (mode === "meet" && interests.length === 0)} className="flex-1 rounded-full" onClick={() => void confirm()}>{busy ? "Confirmando…" : "Confirmar"}</Button></div>
    </div>}

    {here && incoming.length > 0 && <div className="mt-4 space-y-2 border-t border-border pt-3">
      {incoming.map((c) => <div key={c.id} className="rounded-2xl bg-muted p-3">
        <p className="text-sm"><b>{c.other_name}</b> quer te conhecer 👋</p>
        <div className="mt-2 flex gap-1.5">
          <Button size="sm" className="rounded-full" onClick={() => void rpc(() => supabase.rpc("respond_connection", { _id: c.id, _action: "accept" }), "Conexão aceita!")}>✅ Aceitar</Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => void rpc(() => supabase.rpc("respond_connection", { _id: c.id, _action: "decline" }), "Tudo bem.")}>⚪ Agora não</Button>
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => void rpc(() => supabase.rpc("respond_connection", { _id: c.id, _action: "block" }), "Pessoa bloqueada.")}>🚫 Bloquear</Button>
        </div>
      </div>)}
    </div>}

    {here && <div className="mt-4 border-t border-border pt-3">
      <p className="text-sm font-black">👥 Pessoas aqui agora</p>
      {others.length === 0 ? <p className="text-xs text-muted-foreground">Ninguém mais está compartilhando presença agora.</p> :
      <ul className="mt-2 space-y-2">{others.map((x) => {
        const common = x.interests.filter((i) => myInterests.has(i)).length;
        const c = connOf(x.user_id);
        return <li key={x.user_id} className="flex items-start gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-black">{x.first_name.charAt(0)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{x.first_name}</p>
            {x.interests.length > 0 && <p className="text-[11px] text-muted-foreground">{x.interests.join(" · ")}</p>}
            {here.mode === "meet" && x.mode === "meet" && <div className="mt-1.5">
              {!c ? <Button size="sm" variant="outline" className="h-7 rounded-full text-[11px]" onClick={() => void rpc(() => supabase.rpc("send_connection", { _to: x.user_id, _place_id: place.id }), "Pedido enviado.")}>👋 Quero conhecer{common > 0 ? ` · ${common} em comum` : ""}</Button>
                : c.status === "accepted" ? <Button size="sm" className="h-7 rounded-full text-[11px]" onClick={() => setChatId(c.id)}>💬 Conversar</Button>
                : <span className="text-[11px] font-bold text-muted-foreground">{c.incoming ? "Respondido" : "Pedido enviado"}</span>}
            </div>}
          </div>
          <button aria-label={`Denunciar ${x.first_name}`} className="shrink-0 p-1 text-muted-foreground" onClick={() => void report(x.user_id)}><Flag size={14} /></button>
        </li>;
      })}</ul>}
    </div>}

    {here && chat && <ChatSheet requestId={chat.id} name={chat.other_name} onClose={() => setChatId(null)} notify={notify} />}
  </div>;
}

function ChatSheet({ requestId, name, onClose, notify }: { requestId: string; name: string; onClose: () => void; notify: (m: string) => void }) {
  const [text, setText] = useState("");
  const msgs = useQuery({ queryKey: ["chat", requestId], refetchInterval: 4000, queryFn: async () => {
    const { data, error } = await supabase.rpc("chat_messages_for", { _request_id: requestId }); if (error) throw error; return data ?? [];
  } });
  const send = async () => {
    const body = text.trim(); if (!body) return;
    try {
      const { error } = await supabase.rpc("send_chat_message", { _request_id: requestId, _body: body });
      if (error && isNetworkError(error)) { console.error("[erro] chat", error); return notify(OFFLINE_MSG); }
      if (error) { console.error("[erro] chat", error); notify("A conexão terminou."); onClose(); return; }
    } catch (e) { return notify(friendlyError(e, "Não foi possível enviar.", "chat")); }
    setText(""); void msgs.refetch();
  };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40" onClick={onClose}>
    <div className="flex h-[75vh] w-full max-w-md flex-col rounded-t-3xl bg-background" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0"><p className="truncate font-display font-black">{name}</p><p className="text-[11px] font-bold text-primary">🟢 Conexão ativa · Vocês estão no mesmo local</p></div>
        <button aria-label="Fechar" onClick={onClose} className="shrink-0 p-1"><X size={18} /></button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        <p className="text-center text-[10px] text-muted-foreground">Conversa temporária: é apagada quando a presença de um de vocês terminar.</p>
        {(msgs.data ?? []).map((m) => <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>{m.body}</div>)}
      </div>
      <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Mensagem" className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 text-sm" />
        <Button type="submit" size="icon" className="shrink-0 rounded-full" aria-label="Enviar"><Send size={16} /></Button>
      </form>
    </div>
  </div>;
}
