import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft, BookOpen, Bookmark, Camera, Check, ChevronRight, Compass, Crosshair, Eye, EyeOff, Heart, Image as ImageIcon,
  Lock, LogOut, MoreVertical, Map as MapIcon, MapPin, Navigation, Plus, Search, Star, UserRound, X, ExternalLink, Phone, Clock,
  Share2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import flamboyantReal from "@/assets/goiania-flamboyant-real.jpg.asset.json";
import welcomeArt from "@/assets/ce-vai-welcome.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { searchPlaces, getPlaceDetails, ensurePlace, resolvePlacePhotos, GOIANIA, type PlaceSummary } from "@/lib/places.functions";
import { MapView, type MapMarker, type MapArea } from "@/components/cevai/MapView";
import { PresencePanel } from "@/components/cevai/PresencePanel";
import { SituationPanel, useSituations, updatedAgo } from "@/components/cevai/SituationPanel";
import { InstallPrompt, captureSharedLink, takePendingLink, shareUrlFor, PENDING_LINK_KEY } from "@/components/cevai/InstallPrompt";
import { GROUPS, HOME_CHIPS, MAP_CHIPS, filterLabel, filterEmoji, emojiOfLabel, colorOfLabel, criteriaFor, isFair, STALL_CRITERIA, STALL_KINDS, allowsPresence } from "@/lib/categories";

type Screen = "welcome" | "login" | "signup" | "signup-done" | "forgot" | "new-password" | "home" | "map" | "detail" | "saved" | "profile" | "categories";
type MainScreen = "home" | "map" | "saved" | "profile";
type LatLng = { lat: number; lng: number };
type SavedList = "quero_conhecer" | "ja_fui" | "favoritos";

const emojiOf = emojiOfLabel;

const LIST_LABELS: Record<SavedList, string> = { quero_conhecer: "Quero conhecer", ja_fui: "Já fui", favoritos: "Favoritos" };

type Stall = { id: string; place_id: string; name: string; kind: string; emoji: string; created_by: string };
type Experience = {
  id: string; place_id: string; stall_id: string | null; stall: { name: string; emoji: string } | null; category: string; rating: number; comment: string | null; would_return: boolean; is_public: boolean; created_at: string; user_id: string;
  place: { name: string; address: string | null; lat: number | null; lng: number | null; photo_url: string | null } | null;
  scores: Array<{ criterion: string; score: number }>;
  photos: string[];
  photoItems: Array<{ path: string; url: string }>;
};

/** Lets cards owned by the signed-in user open the edit form and refresh lists after changes. */
const ManageCtx = createContext<{ user: User; notify: (m: string) => void; onEdit: (e: Experience) => void } | null>(null);

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Cê Vai? — O mapa das suas escolhas" },
    { name: "description", content: "Descubra lugares reais de Goiânia, registre onde você foi e diga se vale a pena voltar." },
    { property: "og:title", content: "Cê Vai? — O mapa das suas escolhas" },
    { property: "og:description", content: "Descubra lugares reais de Goiânia, registre onde você foi e diga se vale a pena voltar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: CeVaiApp,
});

function distanceKm(a: LatLng, b: LatLng) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`);

function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "text-[2.6rem]" : size === "sm" ? "text-xl" : "text-2xl";
  return <span className={`font-display font-black leading-none tracking-tight ${cls}`}><span className="text-primary">Cê</span> <span className="text-secondary">Vai?</span></span>;
}

/* ---------------- App shell ---------------- */

function CeVaiApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [returnTo, setReturnTo] = useState<MainScreen>("home");
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; place: PlaceSummary | null; stall?: Stall | null; edit?: Experience | null }>({ open: false, place: null });
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);
  const queryClient = useQueryClient();

  const notify = useCallback((m: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = window.setTimeout(() => setToast(""), 2400);
  }, []);
  // Every screen opens at its real top: no browser scroll restoration, no leftover window/inner scroll.
  const screenRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; }, []);
  useLayoutEffect(() => {
    const reset = () => {
      window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0;
      screenRef.current?.querySelectorAll<HTMLElement>(".overflow-y-auto").forEach((el) => { el.scrollTop = 0; });
      if (screenRef.current) screenRef.current.scrollTop = 0;
    };
    reset(); const id = requestAnimationFrame(reset); return () => cancelAnimationFrame(id);
  }, [screen]);
  const go = useCallback((next: Screen, back = false) => { setDirection(back ? "back" : "forward"); setScreen(next); }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
      if (data.session?.user) go("home");
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") go("new-password");
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [go, queryClient]);

  useEffect(() => {
    if (!user) return;
    setProfileName(user.user_metadata?.["full_name"] ?? user.email?.split("@")[0] ?? "");
    void supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle().then(({ data }) => { if (data?.full_name) setProfileName(data.full_name); });
  }, [user]);

  const locate = useCallback((announce = false) => {
    if (!("geolocation" in navigator)) { if (announce) notify("Localização indisponível neste aparelho."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setLocation({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => { if (announce) notify("Sem acesso à localização. Mostrando Goiânia."); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, [notify]);
  useEffect(() => { if (user) locate(); }, [user, locate]);

  const [shared, setShared] = useState(false);
  useEffect(() => { if (captureSharedLink()) setShared(true); }, []);
  useEffect(() => {
    if (!authReady) return;
    if (user) { const id = takePendingLink(); if (id) { setPlaceId(id); setReturnTo("home"); go("detail"); } }
    else if (localStorage.getItem(PENDING_LINK_KEY)) { notify("Entre na sua conta para ver o lugar compartilhado."); go("login"); }
  }, [authReady, user, go, notify]);

  const openPlace = (id: string, from: MainScreen) => { setPlaceId(id); setReturnTo(from); go("detail"); };
  const openModal = (place: PlaceSummary | null = null, stall: Stall | null = null) => {
    if (!user) { notify("Entre na sua conta para registrar experiências."); go("login"); return; }
    setModal({ open: true, place, stall });
  };
  const onAuthed = (u: User) => { setUser(u); go("home"); };

  const center = location ?? GOIANIA;
  const main = screen === "home" || screen === "map" || screen === "saved" || screen === "profile";

  return (
    <main className="h-dvh overflow-hidden bg-background">
      <div className="relative mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-background md:border-x md:border-border">
        <ManageCtx.Provider value={user ? { user, notify, onEdit: (e) => setModal({ open: true, edit: e, place: { id: e.place_id, name: e.place?.name ?? "Lugar", address: e.place?.address ?? "", category: e.category, typeLabel: "", lat: e.place?.lat ?? 0, lng: e.place?.lng ?? 0, rating: null, ratingCount: null, photoUrl: e.place?.photo_url ?? null, photoName: null, photoAttribution: null }, stall: e.stall_id && e.stall ? { id: e.stall_id, place_id: e.place_id, name: e.stall.name, emoji: e.stall.emoji, kind: "", created_by: "" } : null }) } : null}>
        <div key={screen} ref={screenRef} className={`min-h-0 flex-1 ${direction === "back" ? "animate-screen-back" : "animate-screen-in"}`}>
          {screen === "welcome" && <WelcomeScreen ready={authReady} onSignup={() => go("signup")} onLogin={() => go("login")} onExplore={() => go("home")} />}
          {screen === "login" && <LoginScreen onBack={() => go("welcome", true)} onSignup={() => go("signup")} onForgot={() => go("forgot")} onSuccess={onAuthed} notify={notify} />}
          {screen === "signup" && <SignupScreen onBack={() => go("welcome", true)} onLogin={() => go("login")} onDone={(u) => { if (u) setUser(u); go("signup-done"); }} notify={notify} />}
          {screen === "signup-done" && <SignupDoneScreen confirmed={!!user} onContinue={() => go(user ? "home" : "login")} />}
          {screen === "forgot" && <ForgotScreen onBack={() => go("login", true)} notify={notify} />}
          {screen === "new-password" && <NewPasswordScreen onDone={() => go("home")} notify={notify} />}
          {screen === "home" && <HomeScreen user={user} center={center} category={category} onCategory={setCategory} onOpen={(id) => openPlace(id, "home")} onLogin={() => go("login")} onAll={() => go("categories")} />}
          {screen === "categories" && <CategoriesScreen value={category} onBack={() => go("home", true)} onPick={(k) => { setCategory(k); go("home", true); }} />}
          {screen === "map" && <MapScreen user={user} center={center} location={location} category={category} onCategory={setCategory} onLocate={() => locate(true)} onOpen={(id) => openPlace(id, "map")} onLogin={() => go("login")} />}
          {screen === "detail" && placeId && <DetailScreen placeId={placeId} user={user} center={center} onBack={() => go(returnTo, true)} onRegister={openModal} notify={notify} />}
          {screen === "saved" && <SavedScreen user={user} onOpen={(id) => openPlace(id, "saved")} onLogin={() => go("login")} />}
          {screen === "profile" && <ProfileScreen user={user} name={profileName} onOpen={(id) => openPlace(id, "profile")} onLogin={() => go("login")} onSignOut={async () => { await supabase.auth.signOut(); go("welcome", true); }} notify={notify} />}
        </div>
        </ManageCtx.Provider>
        {main && <BottomNav active={screen as MainScreen} onNavigate={(s) => go(s)} onAdd={() => openModal(null)} />}
        {modal.open && user && <ExperienceModal user={user} center={center} location={location} initialPlace={modal.place} initialStall={modal.stall ?? null} editing={modal.edit ?? null} onLocate={() => locate(true)} onClose={() => setModal({ open: false, place: null })} onSaved={() => { setModal({ open: false, place: null }); void queryClient.invalidateQueries({ queryKey: ["experiences"] }); void queryClient.invalidateQueries({ queryKey: ["saved"] }); void queryClient.invalidateQueries({ queryKey: ["place-stats"] }); void queryClient.invalidateQueries({ queryKey: ["stall-stats"] }); notify(modal.edit ? "Experiência atualizada!" : "Experiência registrada!"); }} notify={notify} />}
        <InstallPrompt shared={shared} />
        {toast && <div role="status" className="absolute bottom-24 left-1/2 z-50 flex max-w-[90%] -translate-x-1/2 animate-toast-in items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-bold text-background shadow-xl"><Check size={16} className="shrink-0" />{toast}</div>}
      </div>
    </main>
  );
}

function BottomNav({ active, onNavigate, onAdd }: { active: MainScreen; onNavigate: (s: MainScreen) => void; onAdd: () => void }) {
  const item = (id: MainScreen, label: string, Icon: typeof Compass) => (
    <button onClick={() => onNavigate(id)} aria-current={active === id ? "page" : undefined} className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-bold ${active === id ? "text-primary" : "text-muted-foreground"}`}>
      <Icon size={22} strokeWidth={active === id ? 2.6 : 2} />{label}
    </button>
  );
  return <nav className="relative z-30 flex shrink-0 items-end border-t border-border bg-card px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
    {item("home", "Explorar", Compass)}{item("map", "Mapa", MapIcon)}
    <div className="flex flex-1 justify-center"><button onClick={onAdd} aria-label="Registrar experiência" className="-mt-6 grid size-14 place-items-center rounded-full bg-secondary text-secondary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95"><Plus size={28} strokeWidth={2.8} /></button></div>
    {item("saved", "Salvos", Bookmark)}{item("profile", "Perfil", UserRound)}
  </nav>;
}

/* ---------------- Onboarding & auth ---------------- */

function WelcomeScreen({ ready, onSignup, onLogin, onExplore }: { ready: boolean; onSignup: () => void; onLogin: () => void; onExplore: () => void }) {
  return <section className="relative h-full min-h-dvh overflow-hidden bg-primary">
    <img src={welcomeArt.url} className="absolute inset-x-0 top-0 h-auto min-h-[55%] w-full object-cover object-top [mask-image:linear-gradient(to_bottom,black_78%,transparent)]" alt="Cê Vai? — O mapa das suas escolhas. Parque em Goiânia ao entardecer" />
    <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-primary via-primary/80 to-transparent" />
    <div className="relative z-10 flex h-full flex-col justify-end px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="space-y-3">
        <Button disabled={!ready} onClick={onSignup} className="h-[52px] w-full rounded-full bg-secondary text-base font-extrabold text-secondary-foreground shadow-lg hover:bg-secondary/90">Criar conta</Button>
        <Button disabled={!ready} onClick={onLogin} variant="outline" className="h-[52px] w-full rounded-full border-2 border-primary-foreground/80 bg-primary/30 text-base font-extrabold text-primary-foreground backdrop-blur-sm hover:bg-primary-foreground/10 hover:text-primary-foreground">Entrar</Button>
        <button onClick={onExplore} className="block w-full py-2 text-sm font-bold text-primary-foreground underline underline-offset-4">Explorar sem entrar</button>
      </div>
    </div>
  </section>;
}

function AuthLayout({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return <section className="h-full overflow-y-auto bg-background px-6 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
    <Button variant="ghost" size="icon" aria-label="Voltar" onClick={onBack} className="-ml-2 rounded-full"><ArrowLeft /></Button>
    <div className="mx-auto mt-6 max-w-sm"><Logo size="md" />{children}</div>
  </section>;
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-foreground/80">{label}</span><input {...props} className="h-12 w-full rounded-xl border border-input bg-card px-4 text-[15px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>;
}

function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-foreground/80">{label}</span><div className="relative"><input value={value} onChange={(e) => onChange(e.target.value)} type={show ? "text" : "password"} autoComplete={autoComplete} className="h-12 w-full rounded-xl border border-input bg-card px-4 pr-12 text-[15px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" /><button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-3 text-muted-foreground">{show ? <EyeOff size={20} /> : <Eye size={20} />}</button></div></label>;
}

function GoogleButton({ onSuccess, notify }: { onSuccess: (u: User) => void; notify: (m: string) => void }) {
  return <>
    <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
    <Button variant="outline" onClick={async () => {
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (r.error) return notify("Não foi possível entrar com Google.");
      if (r.redirected) return;
      const { data } = await supabase.auth.getUser();
      if (data.user) onSuccess(data.user);
    }} className="h-12 w-full rounded-full border-border bg-card font-bold text-foreground"><span className="mr-2 font-black text-secondary">G</span>Continuar com Google</Button>
  </>;
}

function LoginScreen({ onBack, onSignup, onForgot, onSuccess, notify }: { onBack: () => void; onSignup: () => void; onForgot: () => void; onSuccess: (u: User) => void; notify: (m: string) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) return notify(error.message.includes("confirm") ? "Confirme seu e-mail antes de entrar." : "E-mail ou senha incorretos.");
    onSuccess(data.user);
  };
  return <AuthLayout onBack={onBack}>
    <h1 className="mt-8 font-display text-[1.75rem] font-black leading-tight">Que bom te ver por aqui.</h1>
    <p className="mt-2 text-sm text-muted-foreground">Entre para continuar seu mapa de experiências.</p>
    <form className="mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <Field label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <PasswordField label="Senha" value={password} onChange={setPassword} autoComplete="current-password" />
      <button type="button" onClick={onForgot} className="text-sm font-bold text-primary">Esqueci minha senha</button>
      <Button type="submit" disabled={loading || !email || password.length < 6} className="h-12 w-full rounded-full bg-primary text-base font-extrabold text-primary-foreground">{loading ? "Entrando…" : "Entrar"}</Button>
    </form>
    <GoogleButton onSuccess={onSuccess} notify={notify} />
    <p className="mt-8 text-center text-sm text-muted-foreground">Ainda não tem conta? <button onClick={onSignup} className="font-extrabold text-secondary">Criar conta</button></p>
  </AuthLayout>;
}

function SignupScreen({ onBack, onLogin, onDone, notify }: { onBack: () => void; onLogin: () => void; onDone: (u: User | null) => void; notify: (m: string) => void }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [loading, setLoading] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== password;
  const submit = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin, data: { full_name: name.trim() } } });
    setLoading(false);
    if (error) return notify(error.message.includes("registered") ? "Este e-mail já tem conta." : "Não foi possível criar a conta.");
    if (data.session && data.user) await supabase.from("profiles").upsert({ user_id: data.user.id, full_name: name.trim() }, { onConflict: "user_id" });
    onDone(data.session ? data.user : null);
  };
  return <AuthLayout onBack={onBack}>
    <h1 className="mt-8 font-display text-[1.75rem] font-black leading-tight">Criar sua conta</h1>
    <p className="mt-2 text-sm text-muted-foreground">Seu diário de lugares, só seu.</p>
    <form className="mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <Field label="Nome" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      <Field label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <PasswordField label="Senha (mín. 6 caracteres)" value={password} onChange={setPassword} autoComplete="new-password" />
      <PasswordField label="Confirmar senha" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      {mismatch && <p className="text-xs font-bold text-destructive">As senhas não conferem.</p>}
      <Button type="submit" disabled={loading || !name.trim() || !email || password.length < 6 || confirm !== password} className="h-12 w-full rounded-full bg-secondary text-base font-extrabold text-secondary-foreground hover:bg-secondary/90">{loading ? "Criando…" : "Criar conta"}</Button>
    </form>
    <p className="mt-8 text-center text-sm text-muted-foreground">Já tem conta? <button onClick={onLogin} className="font-extrabold text-primary">Entrar</button></p>
  </AuthLayout>;
}

function SignupDoneScreen({ confirmed, onContinue }: { confirmed: boolean; onContinue: () => void }) {
  return <section className="flex h-full flex-col items-center justify-center bg-primary px-8 text-center text-primary-foreground">
    <div className="grid size-20 place-items-center rounded-full bg-secondary text-secondary-foreground"><Check size={40} strokeWidth={3} /></div>
    <h1 className="mt-8 font-display text-3xl font-black leading-tight">Pronto! Agora vamos descobrir seus lugares.</h1>
    {!confirmed && <p className="mt-4 text-sm text-primary-foreground/80">Enviamos um link para o seu e-mail. Confirme a conta e depois entre.</p>}
    <Button onClick={onContinue} className="mt-10 h-12 w-full max-w-xs rounded-full bg-background font-extrabold text-primary hover:bg-background/90">{confirmed ? "Começar a explorar" : "Ir para o login"}</Button>
  </section>;
}

function ForgotScreen({ onBack, notify }: { onBack: () => void; notify: (m: string) => void }) {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false);
  return <AuthLayout onBack={onBack}>
    <h1 className="mt-8 font-display text-[1.75rem] font-black">Esqueceu a senha?</h1>
    <p className="mt-2 text-sm text-muted-foreground">{sent ? "Se houver conta com esse e-mail, você vai receber um link para criar uma nova senha." : "Digite seu e-mail e enviaremos um link para redefinir."}</p>
    {!sent && <form className="mt-8 space-y-4" onSubmit={async (e) => { e.preventDefault(); const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin }); if (error) notify("Não foi possível enviar agora."); else setSent(true); }}>
      <Field label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" disabled={!email} className="h-12 w-full rounded-full bg-primary font-extrabold text-primary-foreground">Enviar link</Button>
    </form>}
  </AuthLayout>;
}

function NewPasswordScreen({ onDone, notify }: { onDone: () => void; notify: (m: string) => void }) {
  const [password, setPassword] = useState("");
  return <AuthLayout onBack={onDone}>
    <h1 className="mt-8 font-display text-[1.75rem] font-black">Nova senha</h1>
    <form className="mt-8 space-y-4" onSubmit={async (e) => { e.preventDefault(); const { error } = await supabase.auth.updateUser({ password }); if (error) return notify("Não foi possível alterar a senha."); notify("Senha alterada!"); onDone(); }}>
      <PasswordField label="Nova senha" value={password} onChange={setPassword} autoComplete="new-password" />
      <Button type="submit" disabled={password.length < 6} className="h-12 w-full rounded-full bg-primary font-extrabold text-primary-foreground">Salvar senha</Button>
    </form>
  </AuthLayout>;
}

/* ---------------- Shared pieces ---------------- */

function usePlaces(user: User | null, center: LatLng, category: string | null, query: string, radius?: number, ready = true) {
  const search = useServerFn(searchPlaces);
  // ~1km grid + radius bucket: nearby repeat searches reuse the cached result instead of calling Google again.
  const lat = Math.round(center.lat * 100) / 100; const lng = Math.round(center.lng * 100) / 100;
  const r = radius ? Math.min(25000, Math.max(300, Math.round(radius / 500) * 500)) : undefined;
  return useQuery({
    queryKey: ["places", category, query, lat, lng, r ?? null],
    queryFn: () => search({ data: { query: query || undefined, category: category ?? undefined, lat, lng, ...(r ? { radius: r } : {}) } }),
    enabled: !!user && ready,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

function LoginPrompt({ onLogin, text = "Entre na sua conta para buscar lugares reais, ver fotos e registrar experiências." }: { onLogin: () => void; text?: string }) {
  return <div className="mx-5 mt-6 rounded-2xl bg-primary p-6 text-primary-foreground">
    <Lock size={22} className="text-secondary" />
    <p className="mt-3 font-display text-lg font-black">Falta pouco para descobrir</p>
    <p className="mt-1 text-sm text-primary-foreground/80">{text}</p>
    <Button onClick={onLogin} className="mt-5 h-11 rounded-full bg-secondary px-6 font-extrabold text-secondary-foreground hover:bg-secondary/90">Entrar ou criar conta</Button>
  </div>;
}

function CategoryChips({ value, onChange, chips, withAll = false, onAll, className = "" }: { value: string | null; onChange: (c: string | null) => void; chips: string[]; withAll?: boolean; onAll?: () => void; className?: string }) {
  const extra = value && !chips.includes(value) ? [value] : [];
  return <div className={`flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain scroll-smooth whitespace-nowrap py-1 pl-5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [touch-action:pan-x_pan-y] [&::-webkit-scrollbar]:hidden ${className}`}>
    {withAll && <button onClick={() => onChange(null)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold shadow-sm ${value === null ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>Todos</button>}
    {[...extra, ...chips].map((k) => <button key={k} onClick={() => onChange(value === k ? null : k)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold shadow-sm transition ${value === k ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}><span>{filterEmoji(k)}</span>{filterLabel(k)}</button>)}
    {onAll && <button onClick={onAll} className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-primary/40 px-4 py-2 text-sm font-extrabold text-primary">Ver todas<ChevronRight size={14} /></button>}
    <span aria-hidden className="w-3 shrink-0" />
  </div>;
}

function CategoriesScreen({ value, onBack, onPick }: { value: string | null; onBack: () => void; onPick: (k: string) => void }) {
  return <section className="h-full overflow-y-auto pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
    <div className="flex items-center gap-2 px-3"><Button variant="ghost" size="icon" aria-label="Voltar" onClick={onBack} className="rounded-full"><ArrowLeft /></Button><h1 className="font-display text-2xl font-black">Todas as categorias</h1></div>
    <div className="mt-2 space-y-6 px-5">
      {GROUPS.filter((g) => g.key !== "cafes-g").map((g) => <div key={g.key}>
        <button onClick={() => onPick(g.key)} className="flex w-full items-center justify-between"><h2 className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: g.color }}>{g.emoji} {g.label}</h2><span className="text-[11px] font-bold text-muted-foreground">Ver tudo</span></button>
        <div className="mt-2 grid grid-cols-2 gap-2">{g.subs.map((sub) => <button key={sub.key} onClick={() => onPick(sub.key)} className={`flex items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm font-bold shadow-sm ${value === sub.key ? "bg-primary text-primary-foreground" : "bg-card"}`}><span className="text-lg">{sub.emoji}</span><span className="min-w-0 truncate">{sub.label}</span></button>)}</div>
      </div>)}
      <p className="rounded-2xl bg-muted p-4 text-xs text-muted-foreground">📚 Livros ficam no seu Perfil — eles não são lugares do mapa.</p>
    </div>
  </section>;
}

function PlacePhoto({ src, alt, className = "" }: { src: string | null; alt: string; className?: string }) {
  // Old stored Google URLs expire: on load failure fall back to the existing "sem foto" look.
  const [broken, setBroken] = useState<string | null>(null);
  if (src && broken === src) src = null;
  return src ? <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(src)} className={`object-cover ${className}`} /> : <div className={`grid place-items-center bg-muted text-muted-foreground ${className}`}><ImageIcon size={28} /></div>;
}

function Skeleton({ className }: { className: string }) { return <div className={`animate-pulse rounded-2xl bg-muted ${className}`} />; }

function ErrorBox({ error }: { error: unknown }) {
  return <div className="mx-5 mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error instanceof Error ? error.message : "Não foi possível carregar os lugares."}</div>;
}

/* ---------------- Explorar ---------------- */

function HomeScreen({ user, center, category, onCategory, onOpen, onLogin, onAll }: { user: User | null; center: LatLng; category: string | null; onCategory: (c: string | null) => void; onOpen: (id: string) => void; onLogin: () => void; onAll: () => void }) {
  const [input, setInput] = useState(""); const [query, setQuery] = useState("");
  useEffect(() => { const t = window.setTimeout(() => setQuery(input.trim()), 500); return () => window.clearTimeout(t); }, [input]);
  const places = usePlaces(user, center, category, query);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(new Date()).toUpperCase();
  const stallHits = useQuery({
    queryKey: ["stall-search", query], enabled: !!user && query.length >= 2,
    queryFn: async () => { const { data } = await supabase.from("fair_stalls").select("id, place_id, name, emoji, fair:places(name)").ilike("name", `%${query.replace(/[%_,()]/g, "")}%`).limit(5); return data ?? []; },
  });
  const [first, ...rest] = places.data ?? [];
  const stats = usePlaceStats(user, (places.data ?? []).map((p) => p.id));
  return <section className="h-full overflow-y-auto pb-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
    <header className="flex items-start justify-between px-5">
      <div><p className="text-[11px] font-extrabold tracking-[0.14em] text-secondary">{weekday}, GOIÂNIA</p><h1 className="mt-1 font-display text-[1.9rem] font-black leading-tight">Cê vai aonde?</h1></div>
      <Logo size="sm" />
    </header>
    <form onSubmit={(e) => { e.preventDefault(); setQuery(input.trim()); }} className="mx-5 mt-4 flex h-12 items-center gap-3 rounded-full border border-border bg-card px-4 shadow-sm">
      <Search size={18} className="text-muted-foreground" />
      <input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Buscar lugares" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" placeholder="O que você vai descobrir hoje?" />
      {input && <button type="button" aria-label="Limpar busca" onClick={() => { setInput(""); setQuery(""); }}><X size={18} className="text-muted-foreground" /></button>}
    </form>
    <CategoryChips value={category} onChange={onCategory} chips={HOME_CHIPS} onAll={onAll} className="mt-4" />
    {!user ? <LoginPrompt onLogin={onLogin} /> : <>
      <div className="mt-6 flex items-center justify-between px-5"><h2 className="font-display text-xl font-black">{query ? `Resultados para “${query}”` : category ? `${filterEmoji(category)} ${filterLabel(category)} perto de você` : "Destaques da cidade"}</h2></div>
      {places.isError && <ErrorBox error={places.error} />}
      {places.isLoading && <div className="mt-3 space-y-3 px-5"><Skeleton className="h-56" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>}
      {places.data && places.data.length === 0 && <p className="mx-5 mt-6 rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">Nenhum lugar encontrado. Tente outra busca.</p>}
      {first && <button onClick={() => onOpen(first.id)} className="mx-5 mt-3 block w-[calc(100%-2.5rem)] overflow-hidden rounded-2xl bg-card text-left shadow-md">
        <div className="relative h-52"><PlacePhoto src={first.photoUrl} alt={first.name} className="h-full w-full" /><span className="absolute left-3 top-3 rounded-full bg-background/95 px-3 py-1 text-xs font-extrabold text-primary">{emojiOf(first.category)} {first.category}</span>{first.photoAttribution && <span className="absolute bottom-2 right-3 text-[10px] font-semibold text-primary-foreground drop-shadow">Foto: {first.photoAttribution}</span>}</div>
        <div className="p-4"><p className="font-display text-lg font-black">{first.name}</p><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin size={14} /><span className="truncate">{first.address}</span></p><p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-foreground/80"><GoogleRating rating={first.rating} size="md" /><span>· {formatKm(distanceKm(center, first))}</span></p><p className="mt-1"><CeVaiRating stat={stats.data?.[first.id]} /></p></div>
      </button>}
      {stallHits.data && stallHits.data.length > 0 && <div className="mt-5 px-5"><p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Barraquinhas cadastradas pela comunidade</p><div className="mt-2 space-y-2">{stallHits.data.map((st) => <button key={st.id} onClick={() => onOpen(st.place_id)} className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-sm"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-xl">{st.emoji}</span><div className="min-w-0"><p className="truncate font-bold">{st.name}</p><p className="truncate text-xs text-muted-foreground">em {st.fair?.name ?? "feira"}</p></div></button>)}</div></div>}
      <div className="mt-3 space-y-3 px-5">{rest.map((p) => <PlaceRow key={p.id} place={p} center={center} stat={stats.data?.[p.id]} onOpen={() => onOpen(p.id)} />)}</div>
      {places.data && places.data.length > 0 && <p className="mt-4 px-5 text-center text-[10px] text-muted-foreground">Dados e fotos: Google Maps</p>}
    </>}
  </section>;
}

type PlaceStat = { avg: number; count: number };
function usePlaceStats(user: User | null, ids: string[]) {
  const key = [...ids].sort().join(",");
  return useQuery({
    queryKey: ["place-stats", key],
    enabled: !!user && ids.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("place_experience_stats", { _place_ids: ids });
      if (error) throw error;
      const map: Record<string, PlaceStat> = {};
      (data ?? []).forEach((r) => { map[r.place_id] = { avg: Number(r.avg_rating), count: Number(r.experience_count) }; });
      return map;
    },
  });
}
const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");
function GoogleRating({ rating, count, size = "sm" }: { rating: number | null; count?: number | null; size?: "sm" | "md" }) {
  if (!rating) return <span className="text-muted-foreground">Sem nota no Google</span>;
  return <span className="inline-flex items-center gap-1"><Star size={size === "md" ? 14 : 11} className="fill-secondary text-secondary" />{fmt1(rating)}<span className="rounded-sm bg-muted px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">Google</span>{count ? <span className="font-semibold text-muted-foreground">({count})</span> : null}</span>;
}
function CeVaiRating({ stat }: { stat?: PlaceStat | undefined }) {
  if (!stat?.count) return <span className="text-[11px] font-semibold italic text-muted-foreground">Ainda sem experiências no Cê Vai?</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-primary"><Heart size={11} className="fill-secondary text-secondary" />{fmt1(stat.avg)} · Cê Vai? · {stat.count} {stat.count === 1 ? "experiência" : "experiências"}</span>;
}

function PlaceRow({ place, center, stat, onOpen }: { place: PlaceSummary; center: LatLng; stat?: PlaceStat | undefined; onOpen: () => void }) {
  return <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl bg-card p-2.5 text-left shadow-sm">
    <PlacePhoto src={place.photoUrl} alt={place.name} className="size-20 shrink-0 rounded-xl" />
    <div className="min-w-0 flex-1"><p className="text-[11px] font-extrabold text-secondary">{emojiOf(place.category)} {place.typeLabel || place.category}</p><p className="truncate font-display text-base font-black">{place.name}</p><p className="truncate text-xs text-muted-foreground">{place.address}</p><p className="mt-1 flex flex-wrap gap-x-1.5 text-[11px] font-bold text-foreground/70"><GoogleRating rating={place.rating} /><span>· {formatKm(distanceKm(center, place))}</span></p><CeVaiRating stat={stat} /></div>
    <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
  </button>;
}

/* ---------------- Mapa ---------------- */

function MapScreen({ user, center, location, category, onCategory, onLocate, onOpen, onLogin }: { user: User | null; center: LatLng; location: LatLng | null; category: string | null; onCategory: (c: string | null) => void; onLocate: () => void; onOpen: (id: string) => void; onLogin: () => void }) {
  const [input, setInput] = useState(""); const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  // `area` = region last searched; `view` = region currently on screen (updated when the user stops moving).
  const [area, setArea] = useState<MapArea | null>(null);
  const [view, setView] = useState<MapArea | null>(null);
  useEffect(() => { setArea(null); }, [center.lat, center.lng]);
  const onIdle = useCallback((a: MapArea) => { setView(a); setArea((prev) => prev ?? a); }, []);
  const places = usePlaces(user, area ?? center, category, query, area?.radius, !!area || !!query); // wait for the map's final viewport: one Google call per opening
  const moved = !!(area && view) && (distanceKm(area, view) * 1000 > area.radius * 0.35 || view.radius > area.radius * 1.6 || view.radius < area.radius / 1.6);
  const sits = useSituations(user, (places.data ?? []).map((p) => p.id));
  const markers = useMemo<MapMarker[]>(() => (places.data ?? []).map((p) => { const st = sits.data?.[p.id]?.situations; return { id: p.id, lat: p.lat, lng: p.lng, category: p.category, label: st?.length ? `${p.name} · ${st[0]}` : p.name, badge: st?.[0]?.split(" ")[0] }; }), [places.data, sits.data]);
  const current = places.data?.find((p) => p.id === selected) ?? null;
  const curSit = current ? sits.data?.[current.id] : undefined;
  const stats = usePlaceStats(user, current ? [current.id] : []);
  return <section className="relative h-full">
    <MapView center={center} user={location} markers={markers} selectedId={selected} onSelect={setSelected} onIdle={onIdle} cluster fit={!!query} className="absolute inset-0" />
    {user && moved && !places.isFetching && !current && <button onClick={() => { setSelected(null); setArea(view); }} className="absolute left-1/2 top-[calc(max(1rem,env(safe-area-inset-top))+7.5rem)] z-20 -translate-x-1/2 animate-tab-in rounded-full bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground shadow-lg">🔎 Buscar nesta área</button>}
    <div className="absolute inset-x-0 top-0 z-10 space-y-3 bg-gradient-to-b from-background/90 to-transparent pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <form onSubmit={(e) => { e.preventDefault(); setSelected(null); setQuery(input.trim()); }} className="mx-5 flex h-12 items-center gap-3 rounded-full bg-card px-4 shadow-lg">
        <Search size={18} className="text-muted-foreground" />
        <input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Buscar no mapa" placeholder="Buscar lugar no mapa" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
        {query && <button type="button" aria-label="Limpar" onClick={() => { setInput(""); setQuery(""); }}><X size={18} /></button>}
      </form>
      <CategoryChips value={category} onChange={(c) => { setSelected(null); onCategory(c); }} chips={MAP_CHIPS} withAll />
    </div>
    <button onClick={onLocate} aria-label="Minha localização" className="absolute right-4 z-10 grid size-12 place-items-center rounded-full bg-card text-primary shadow-lg" style={{ bottom: current ? "13.5rem" : "1.25rem" }}><Crosshair size={22} /></button>
    {!user && <div className="absolute inset-x-0 bottom-4 z-10"><LoginPrompt onLogin={onLogin} text="Entre para ver lugares reais perto de você no mapa." /></div>}
    {user && places.isLoading && <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-card px-4 py-2 text-sm font-bold shadow-lg">Buscando lugares…</div>}
    {user && places.isError && <div className="absolute inset-x-0 bottom-4 z-10"><ErrorBox error={places.error} /></div>}
    {current && <div className="absolute inset-x-4 bottom-4 z-20 animate-tab-in overflow-hidden rounded-2xl bg-card shadow-2xl">
      <div className="flex gap-3 p-3">
        <PlacePhoto src={current.photoUrl} alt={current.name} className="size-24 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1"><p className="text-[11px] font-extrabold" style={{ color: colorOfLabel(current.category) }}>{emojiOf(current.category)} {current.typeLabel || current.category}</p><p className="truncate font-display text-lg font-black">{current.name}</p><p className="line-clamp-2 text-xs text-muted-foreground">{current.address}</p><p className="mt-1 text-xs font-bold text-foreground/80"><Navigation size={11} className="mr-1 inline" />{formatKm(distanceKm(center, current))} · <GoogleRating rating={current.rating} /></p><CeVaiRating stat={stats.data?.[current.id]} />{curSit?.situations?.length && curSit.updated_at ? <p className="mt-1 truncate text-[11px] font-bold text-secondary">📍 {curSit.situations.join(" · ")} · {updatedAgo(curSit.updated_at).replace("Atualizado ", "")}</p> : null}</div>
        <button aria-label="Fechar" onClick={() => setSelected(null)} className="self-start text-muted-foreground"><X size={18} /></button>
      </div>
      <div className="px-3 pb-3"><Button onClick={() => onOpen(current.id)} className="h-11 w-full rounded-full bg-primary font-extrabold text-primary-foreground">Ver lugar</Button></div>
    </div>}
  </section>;
}

/* ---------------- Data: experiences & saved ---------------- */

async function loadExperiences(filter: { userId?: string; placeId?: string; stallId?: string }): Promise<Experience[]> {
  let q = supabase.from("experiences").select("id, place_id, stall_id, stall:fair_stalls(name, emoji), category, rating, comment, would_return, is_public, created_at, user_id, place:places(name, address, lat, lng, photo_url, photo_name), scores:experience_scores(criterion, score), photos:experience_photos(storage_path)").order("created_at", { ascending: false });
  if (filter.userId) q = q.eq("user_id", filter.userId);
  if (filter.placeId) q = q.eq("place_id", filter.placeId);
  if (filter.stallId) q = q.eq("stall_id", filter.stallId);
  const { data, error } = await q;
  if (error) throw error;
  const paths = (data ?? []).flatMap((e) => (e.photos ?? []).map((p) => p.storage_path));
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("experience-photos").createSignedUrls(paths, 3600);
    signed?.forEach((s) => { if (s.path && s.signedUrl) urls[s.path] = s.signedUrl; });
  }
  return (await withFreshPhotos(data ?? [])).map((e) => ({ ...e, place: e.place as Experience["place"], stall: e.stall as Experience["stall"], scores: e.scores ?? [], photos: (e.photos ?? []).map((p) => urls[p.storage_path]).filter((u): u is string => !!u), photoItems: (e.photos ?? []).filter((p) => urls[p.storage_path]).map((p) => ({ path: p.storage_path, url: urls[p.storage_path]! })) }));
}

/** Rows joined with `places`: replace photo_url with a fresh URL generated from photo_name (old rows keep their stored URL). */
async function withFreshPhotos<T extends { place: unknown }>(rows: T[]): Promise<T[]> {
  const names = [...new Set(rows.map((r) => (r.place as { photo_name?: string | null } | null)?.photo_name).filter((n): n is string => !!n))].slice(0, 50);
  if (!names.length) return rows;
  let urls: Record<string, string> = {};
  try { urls = await resolvePlacePhotos({ data: { names } }); } catch { /* keep stored URLs / "sem foto" */ }
  return rows.map((r) => {
    const p = r.place as { photo_name?: string | null; photo_url: string | null } | null;
    if (!p?.photo_name || !urls[p.photo_name]) return r;
    return { ...r, place: { ...p, photo_url: urls[p.photo_name] } };
  });
}

function useSaved(user: User | null) {
  return useQuery({
    queryKey: ["saved", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("saved_places").select("place_id, list, created_at, place:places(name, address, category, photo_url, photo_name, lat, lng)").order("created_at", { ascending: false });
      if (error) throw error;
      return withFreshPhotos(data ?? []);
    },
  });
}

/* ---------------- Página do lugar ---------------- */

function DetailScreen({ placeId, user, center, onBack, onRegister, notify }: { placeId: string; user: User | null; center: LatLng; onBack: () => void; onRegister: (p: PlaceSummary, stall?: Stall | null) => void; notify: (m: string) => void }) {
  const details = useServerFn(getPlaceDetails);
  const queryClient = useQueryClient();
  const place = useQuery({ queryKey: ["place", placeId], queryFn: () => details({ data: { placeId } }), enabled: !!user, staleTime: 30 * 60 * 1000, retry: false });
  const experiences = useQuery({ queryKey: ["experiences", "place", placeId], queryFn: () => loadExperiences({ placeId }), enabled: !!user });
  const saved = useSaved(user);
  const stats = usePlaceStats(user, [placeId]);
  const [tab, setTab] = useState<"Sobre" | "Experiências" | "Fotos" | "Barraquinhas">("Sobre");
  const lists = new Set((saved.data ?? []).filter((s) => s.place_id === placeId).map((s) => s.list as SavedList));

  const toggle = async (list: SavedList) => {
    if (!user) return;
    if (lists.has(list)) await supabase.from("saved_places").delete().match({ user_id: user.id, place_id: placeId, list });
    else await supabase.from("saved_places").insert({ user_id: user.id, place_id: placeId, list });
    notify(lists.has(list) ? `Removido de “${LIST_LABELS[list]}”` : `Adicionado a “${LIST_LABELS[list]}”`);
    void queryClient.invalidateQueries({ queryKey: ["saved"] });
  };

  const p = place.data;
  return <section className="flex h-full flex-col">
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="relative h-72 bg-muted">
        {p ? <PlacePhoto src={p.photoUrl} alt={p.name} className="h-full w-full" /> : <Skeleton className="h-full rounded-none" />}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-transparent to-foreground/20" />
        <button onClick={onBack} aria-label="Voltar" className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] grid size-10 place-items-center rounded-full bg-background/95 shadow"><ArrowLeft size={20} /></button>
        <button aria-label="Compartilhar lugar" onClick={async () => { const url = shareUrlFor(placeId); try { if (navigator.share) await navigator.share({ title: p?.name ?? "Cê Vai?", text: p ? `${p.name} no Cê Vai?` : "Olha esse lugar no Cê Vai?", url }); else { await navigator.clipboard.writeText(url); notify("Link copiado!"); } } catch { /* cancelado */ } }} className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid size-10 place-items-center rounded-full bg-background/95 shadow"><Share2 size={18} /></button>
        {p && <div className="absolute inset-x-5 bottom-4 text-primary-foreground"><p className="text-xs font-extrabold uppercase tracking-wider text-secondary">{emojiOf(p.category)} {p.typeLabel || p.category}</p><h1 className="mt-1 font-display text-[1.7rem] font-black leading-tight">{p.name}</h1></div>}
      </div>
      {!user && <LoginPrompt onLogin={onBack} />}
      {place.isError && <ErrorBox error={place.error} />}
      {p && <>
        <div className="px-5 pt-4">
          <p className="flex items-start gap-2 text-sm text-foreground/80"><MapPin size={16} className="mt-0.5 shrink-0 text-secondary" />{p.address}</p>
          <p className="mt-1 text-xs font-bold text-muted-foreground">{formatKm(distanceKm(center, p))} de você</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-border bg-muted/60 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Avaliação do Google</p><p className="mt-1 text-sm font-black"><GoogleRating rating={p.rating} count={p.ratingCount} size="md" /></p><p className="mt-1 text-[10px] text-muted-foreground">Informação externa</p></div>
            <div className="rounded-2xl border border-secondary/40 bg-secondary/10 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wider text-secondary">Experiências no Cê Vai?</p>{(() => { const st = stats.data?.[p.id]; return st?.count ? <><p className="mt-1 flex items-center gap-1 font-display text-lg font-black text-primary"><Heart size={15} className="fill-secondary text-secondary" />{fmt1(st.avg)}</p><p className="text-[10px] font-bold text-muted-foreground">{st.count} {st.count === 1 ? "experiência" : "experiências"}</p></> : <p className="mt-1 text-[11px] font-semibold text-muted-foreground">Ainda não há experiências registradas no Cê Vai?.</p>; })()}</div>
          </div>
          {user && <SituationPanel user={user} place={p} notify={notify} />}
          {user && allowsPresence(p.category) && <PresencePanel user={user} place={p} notify={notify} />}
        </div>
        <div className="sticky top-0 z-10 mt-4 flex border-b border-border bg-background px-5">
          {(isFair(p.category, p.name) ? ["Sobre", "Barraquinhas", "Experiências", "Fotos"] as const : ["Sobre", "Experiências", "Fotos"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`flex-1 border-b-2 py-3 text-[13px] font-extrabold ${tab === t ? "border-secondary text-primary" : "border-transparent text-muted-foreground"}`}>{t}</button>)}
        </div>
        <div key={tab} className="animate-tab-in px-5 py-5">
          {tab === "Sobre" && <div className="space-y-4 text-sm">
            {p.summary && <p className="leading-relaxed text-foreground/85">{p.summary}</p>}
            {p.hours.length > 0 && <div className="rounded-2xl bg-card p-4 shadow-sm"><p className="mb-2 flex items-center gap-2 font-extrabold"><Clock size={16} />Horários</p>{p.hours.map((h) => <p key={h} className="text-xs leading-6 text-muted-foreground">{h}</p>)}</div>}
            <div className="flex flex-wrap gap-2">
              {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-xs font-bold shadow-sm"><Phone size={14} />{p.phone}</a>}
              {p.website && <a href={p.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-xs font-bold shadow-sm"><ExternalLink size={14} />Site</a>}
              {p.mapsUrl && <a href={p.mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-xs font-bold shadow-sm"><Navigation size={14} />Como chegar</a>}
            </div>
            <p className="text-[10px] text-muted-foreground">Informações do Google Maps.</p>
          </div>}
          {tab === "Experiências" && <div>
            <h2 className="font-display text-lg font-black">Experiências no Cê Vai?</h2>
            <p className="mt-1 text-xs text-muted-foreground">Suas experiências são privadas. Aqui aparecem as suas e as que outras pessoas escolheram compartilhar.</p>
            <div className="mt-4 space-y-3">
              {experiences.data?.filter((e) => !e.stall_id).length ? experiences.data.filter((e) => !e.stall_id).map((e) => <ExperienceCard key={e.id} exp={e} own={e.user_id === user?.id} />) : <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Ninguém registrou este lugar ainda. Foi lá? Registre sua experiência.</div>}
            </div>
          </div>}
          {tab === "Barraquinhas" && user && <StallsPanel place={p} user={user} onRegister={(st) => onRegister(p, st)} notify={notify} />}
          {tab === "Fotos" && <div>
            <div className="flex items-center justify-between"><h2 className="font-display text-lg font-black">Fotos do local</h2><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-extrabold text-muted-foreground">Google Places</span></div>
            {p.photos.length ? <div className="mt-3 grid grid-cols-2 gap-2">{p.photos.map((ph, i) => <figure key={ph.url} className={`relative overflow-hidden rounded-xl ${i === 0 ? "col-span-2 h-52" : "h-32"}`}><img src={ph.url} alt={`${p.name} — foto ${i + 1}`} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />{ph.attribution && <figcaption className="absolute bottom-1 left-2 text-[9px] font-semibold text-primary-foreground drop-shadow">{ph.attribution}</figcaption>}</figure>)}</div> : <p className="mt-3 text-sm text-muted-foreground">O Google não tem fotos deste lugar.</p>}
            <p className="mt-6 text-xs text-muted-foreground">Fotos enviadas por usuários ficam na aba Experiências, separadas das fotos do Google.</p>
          </div>}
        </div>
      </>}
    </div>
    {p && user && <div className="flex shrink-0 gap-2 border-t border-border bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <Button variant="outline" onClick={() => void toggle("quero_conhecer")} className={`h-12 flex-1 rounded-full font-extrabold ${lists.has("quero_conhecer") ? "border-primary bg-primary/10 text-primary" : ""}`}><Bookmark size={18} className={lists.has("quero_conhecer") ? "fill-current" : ""} />Quero ir</Button>
      <Button variant="outline" size="icon" aria-label="Favoritar" onClick={() => void toggle("favoritos")} className={`size-12 rounded-full ${lists.has("favoritos") ? "border-secondary text-secondary" : ""}`}><Heart size={20} className={lists.has("favoritos") ? "fill-current" : ""} /></Button>
      <Button onClick={() => onRegister(p)} className="h-12 flex-[1.3] rounded-full bg-secondary font-extrabold text-secondary-foreground hover:bg-secondary/90"><Plus size={18} />Eu fui</Button>
    </div>}
  </section>;
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return <span className="flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} className={n <= value ? "fill-secondary text-secondary" : "text-border"} />)}</span>;
}

function ExperienceCard({ exp, own, showPlace = false, onOpen }: { exp: Experience; own: boolean; showPlace?: boolean; onOpen?: () => void }) {
  const date = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(exp.created_at));
  return <article className="overflow-hidden rounded-2xl bg-card shadow-sm">
    {exp.photos.length > 0 && <div className="flex gap-1 overflow-x-auto">{exp.photos.map((u) => <img key={u} src={u} alt="Foto da experiência" className="h-40 w-full min-w-[70%] flex-1 object-cover" />)}</div>}
    <div className="relative p-4">
      {own && <ExperienceMenu exp={exp} />}
      {showPlace && <button onClick={onOpen} className="mb-1 pr-8 font-display text-base font-black text-left">{exp.place?.name ?? "Lugar"}</button>}
      {exp.stall && <p className="mb-1 text-xs font-extrabold text-secondary">{exp.stall.emoji} Barraquinha: {exp.stall.name}</p>}
      <div className={`flex items-center justify-between ${own && !showPlace ? "pr-8" : ""}`}><Stars value={exp.rating} /><span className="text-[11px] font-bold text-muted-foreground">{own ? "Você" : "Comunidade"} · {date}</span></div>
      {exp.comment && <p className="mt-2 text-sm leading-relaxed text-foreground/85">{exp.comment}</p>}
      {exp.scores.length > 0 && <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">{exp.scores.map((s) => <p key={s.criterion} className="flex justify-between text-[11px] text-muted-foreground"><span>{s.criterion}</span><span className="font-extrabold text-foreground">{s.score}/5</span></p>)}</div>}
      <div className="mt-3 flex gap-2 text-[11px] font-extrabold"><span className={`rounded-full px-2.5 py-1 ${exp.would_return ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{exp.would_return ? "❤️ Voltaria" : "Não voltaria"}</span>{own && <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"><Lock size={10} />{exp.is_public ? "Compartilhada" : "Privada"}</span>}</div>
    </div>
  </article>;
}

function ExperienceMenu({ exp }: { exp: Experience }) {
  const ctx = useContext(ManageCtx);
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!ctx || exp.user_id !== ctx.user.id) return null;
  const refresh = () => { for (const k of ["experiences", "place-stats", "stall-stats"]) void qc.invalidateQueries({ queryKey: [k] }); };
  const togglePrivacy = async () => {
    const { error } = await supabase.from("experiences").update({ is_public: !exp.is_public }).eq("id", exp.id).eq("user_id", ctx.user.id);
    if (error) return ctx.notify("Não foi possível alterar a privacidade.");
    refresh(); ctx.notify(exp.is_public ? "Agora só você vê esta experiência." : "Experiência compartilhada.");
  };
  const remove = async () => {
    setBusy(true);
    if (exp.photoItems.length) await supabase.storage.from("experience-photos").remove(exp.photoItems.map((p) => p.path));
    // Photos and criteria rows are removed by the database together with the experience; the place stays.
    const { error } = await supabase.from("experiences").delete().eq("id", exp.id).eq("user_id", ctx.user.id);
    setBusy(false); setConfirm(false);
    if (error) return ctx.notify("Não foi possível excluir.");
    refresh(); ctx.notify("Experiência excluída.");
  };
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button aria-label="Gerenciar experiência" className="absolute right-2 top-3 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"><MoreVertical size={18} /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl">
        <DropdownMenuItem onSelect={() => ctx.onEdit(exp)}>✏️ Editar experiência</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void togglePrivacy()}>🔒 {exp.is_public ? "Tornar privada" : "Compartilhar"}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-destructive focus:text-destructive">🗑️ Excluir experiência</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={confirm} onOpenChange={setConfirm}>
      <AlertDialogContent className="max-w-[90%] rounded-2xl sm:max-w-sm">
        <AlertDialogHeader><AlertDialogTitle>Excluir esta experiência?</AlertDialogTitle><AlertDialogDescription>Essa ação não poderá ser desfeita.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void remove(); }} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}

/* ---------------- Feiras: barraquinhas ---------------- */

function StallsPanel({ place, user, onRegister, notify }: { place: PlaceSummary; user: User; onRegister: (s: Stall) => void; notify: (m: string) => void }) {
  const qc = useQueryClient();
  const stalls = useQuery({ queryKey: ["stalls", place.id], queryFn: async () => { const { data, error } = await supabase.from("fair_stalls").select("id, place_id, name, kind, emoji, created_by").eq("place_id", place.id).order("created_at"); if (error) throw error; return data as Stall[]; } });
  const ids = (stalls.data ?? []).map((x) => x.id);
  const stats = useQuery({ queryKey: ["stall-stats", ids.join(",")], enabled: ids.length > 0, queryFn: async () => { const { data } = await supabase.rpc("stall_experience_stats", { _stall_ids: ids }); const m: Record<string, PlaceStat> = {}; (data ?? []).forEach((r) => { m[r.stall_id] = { avg: Number(r.avg_rating), count: Number(r.experience_count) }; }); return m; } });
  const [adding, setAdding] = useState(false); const [name, setName] = useState(""); const [kind, setKind] = useState(STALL_KINDS[0]!);
  const ensure = useServerFn(ensurePlace);
  const add = async () => {
    try { await ensure({ data: { placeId: place.id } }); } catch { return notify("Não foi possível adicionar a barraquinha."); }
    const { error } = await supabase.from("fair_stalls").insert({ place_id: place.id, name: name.trim(), kind: kind.kind, emoji: kind.emoji, created_by: user.id });
    if (error) return notify("Não foi possível adicionar a barraquinha.");
    setName(""); setAdding(false); notify("Barraquinha adicionada!"); void qc.invalidateQueries({ queryKey: ["stalls", place.id] });
  };
  return <div>
    <h2 className="font-display text-lg font-black">Barraquinhas desta feira</h2>
    <p className="mt-1 text-xs text-muted-foreground">Cadastradas pela comunidade do Cê Vai? — não vêm do Google. Cada barraquinha tem suas próprias experiências, separadas da nota da feira.</p>
    <div className="mt-4 space-y-2">
      {stalls.data?.map((st) => { const stat = stats.data?.[st.id]; return <div key={st.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-2xl">{st.emoji}</span>
        <div className="min-w-0 flex-1"><p className="truncate font-bold">{st.name}</p><p className="text-[10px] font-bold text-muted-foreground">{st.kind} · criado pela comunidade</p><CeVaiRating stat={stat} /></div>
        <Button size="sm" onClick={() => onRegister(st)} className="shrink-0 rounded-full bg-secondary text-xs font-extrabold text-secondary-foreground hover:bg-secondary/90">Eu fui</Button>
      </div>; })}
      {stalls.data?.length === 0 && <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Nenhuma barraquinha cadastrada ainda.</p>}
    </div>
    {adding ? <div className="mt-4 space-y-3 rounded-2xl bg-card p-4 shadow-sm">
      <Field label="Nome da barraquinha" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Pastel da Dona Maria" />
      <div className="flex flex-wrap gap-2">{STALL_KINDS.map((k) => <button key={k.kind} onClick={() => setKind(k)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${kind.kind === k.kind ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{k.emoji} {k.kind}</button>)}</div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setAdding(false)} className="flex-1 rounded-full">Cancelar</Button><Button disabled={name.trim().length < 2} onClick={() => void add()} className="flex-1 rounded-full bg-primary font-extrabold text-primary-foreground">Adicionar</Button></div>
    </div> : <Button variant="outline" onClick={() => setAdding(true)} className="mt-4 h-11 w-full rounded-full border-dashed font-extrabold"><Plus size={16} />Adicionar barraquinha</Button>}
  </div>;
}

/* ---------------- Livros ---------------- */

const BOOK_STATUS = { quero_ler: "Quero ler", lendo: "Lendo", terminei: "Terminei" } as const;
type BookStatus = keyof typeof BOOK_STATUS;

function BooksPanel({ user, notify }: { user: User; notify: (m: string) => void }) {
  const qc = useQueryClient();
  const books = useQuery({ queryKey: ["books", user.id], queryFn: async () => {
    const { data, error } = await supabase.from("books").select("*").order("created_at", { ascending: false }); if (error) throw error;
    const paths = (data ?? []).map((b) => b.photo_path).filter((x): x is string => !!x); const urls: Record<string, string> = {};
    if (paths.length) { const { data: sg } = await supabase.storage.from("experience-photos").createSignedUrls(paths, 3600); sg?.forEach((x) => { if (x.path && x.signedUrl) urls[x.path] = x.signedUrl; }); }
    return (data ?? []).map((b) => ({ ...b, photo: b.photo_path ? urls[b.photo_path] ?? null : null }));
  } });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(""); const [author, setAuthor] = useState(""); const [status, setStatus] = useState<BookStatus>("terminei");
  const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [rec, setRec] = useState(true); const [file, setFile] = useState<File | null>(null); const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    let photo_path: string | null = null;
    if (file && file.size <= 10 * 1024 * 1024) { const path = `${user.id}/books/${Date.now()}.${(file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "")}`; const up = await supabase.storage.from("experience-photos").upload(path, file, { contentType: file.type }); if (!up.error) photo_path = path; }
    const { error } = await supabase.from("books").insert({ user_id: user.id, title: title.trim(), author: author.trim() || null, status, rating: rating || null, comment: comment.trim() || null, would_recommend: status === "terminei" ? rec : null, photo_path });
    setSaving(false);
    if (error) return notify("Não foi possível salvar o livro.");
    setOpen(false); setTitle(""); setAuthor(""); setRating(0); setComment(""); setFile(null); notify("Livro registrado!"); void qc.invalidateQueries({ queryKey: ["books"] });
  };
  return <div>
    {open ? <div className="space-y-3 rounded-2xl bg-card p-4 shadow-sm">
      <Field label="Título" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: O Pequeno Príncipe" />
      <Field label="Autor (opcional)" value={author} maxLength={120} onChange={(e) => setAuthor(e.target.value)} />
      <div className="flex gap-2">{(Object.keys(BOOK_STATUS) as BookStatus[]).map((k) => <button key={k} onClick={() => setStatus(k)} className={`flex-1 rounded-full py-2 text-xs font-bold ${status === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{BOOK_STATUS[k]}</button>)}</div>
      {status !== "quero_ler" && <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${n} estrelas`} onClick={() => setRating(n)}><Star size={28} className={n <= rating ? "fill-secondary text-secondary" : "text-border"} /></button>)}</div>}
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={2} placeholder="Minha experiência com o livro" className="w-full resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none" />
      <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Camera size={16} />{file ? file.name : "Adicionar foto (opcional)"}<input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      {status === "terminei" && <button onClick={() => setRec((v) => !v)} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${rec ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{rec ? "❤️ Recomendo" : "Não recomendo"}</button>}
      <div className="flex gap-2"><Button variant="outline" onClick={() => setOpen(false)} className="flex-1 rounded-full">Cancelar</Button><Button disabled={!title.trim() || saving} onClick={() => void save()} className="flex-1 rounded-full bg-secondary font-extrabold text-secondary-foreground hover:bg-secondary/90">{saving ? "Salvando…" : "Salvar livro"}</Button></div>
    </div> : <Button onClick={() => setOpen(true)} variant="outline" className="h-11 w-full rounded-full border-dashed font-extrabold"><BookOpen size={16} />Registrar livro</Button>}
    <div className="mt-3 space-y-2">{books.data?.map((b) => <div key={b.id} className="flex gap-3 rounded-2xl bg-card p-3 shadow-sm">
      {b.photo ? <img src={b.photo} alt={b.title} className="h-20 w-14 shrink-0 rounded-lg object-cover" /> : <div className="grid h-20 w-14 shrink-0 place-items-center rounded-lg bg-muted text-2xl">📖</div>}
      <div className="min-w-0 flex-1"><p className="truncate font-display font-black">{b.title}</p>{b.author && <p className="truncate text-xs text-muted-foreground">{b.author}</p>}<div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold"><span className="rounded-full bg-muted px-2 py-0.5">{BOOK_STATUS[b.status as BookStatus]}</span>{b.rating && <Stars value={b.rating} size={11} />}{b.would_recommend && <span className="text-primary">❤️ Recomendo</span>}</div>{b.comment && <p className="mt-1 line-clamp-2 text-xs text-foreground/80">{b.comment}</p>}</div>
    </div>)}</div>
    {books.data?.length === 0 && !open && <p className="mt-2 text-center text-xs text-muted-foreground">Seus livros ficam privados aqui.</p>}
  </div>;
}

/* ---------------- Salvos ---------------- */

function SavedScreen({ user, onOpen, onLogin }: { user: User | null; onOpen: (id: string) => void; onLogin: () => void }) {
  const saved = useSaved(user);
  const [list, setList] = useState<SavedList>("quero_conhecer");
  const items = (saved.data ?? []).filter((s) => s.list === list);
  return <section className="h-full overflow-y-auto pb-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
    <h1 className="px-5 font-display text-[1.75rem] font-black">Seus lugares salvos</h1>
    {!user ? <LoginPrompt onLogin={onLogin} text="Entre para guardar lugares que quer conhecer e seus favoritos." /> : <>
      <div className="mt-4 flex gap-2 px-5">{(Object.keys(LIST_LABELS) as SavedList[]).map((l) => <button key={l} onClick={() => setList(l)} className={`rounded-full px-4 py-2 text-sm font-bold ${list === l ? "bg-primary text-primary-foreground" : "bg-card text-foreground shadow-sm"}`}>{LIST_LABELS[l]}</button>)}</div>
      <div className="mt-5 grid grid-cols-2 gap-3 px-5">
        {items.map((s) => <button key={s.place_id} onClick={() => onOpen(s.place_id)} className="overflow-hidden rounded-2xl bg-card text-left shadow-sm"><PlacePhoto src={s.place?.photo_url ?? null} alt={s.place?.name ?? ""} className="h-28 w-full" /><div className="p-3"><p className="text-[10px] font-extrabold text-secondary">{emojiOf(s.place?.category ?? "")} {s.place?.category}</p><p className="line-clamp-2 font-display text-sm font-black">{s.place?.name}</p></div></button>)}
      </div>
      {!saved.isLoading && items.length === 0 && <p className="mx-5 mt-2 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{list === "ja_fui" ? "Registre uma experiência e o lugar aparece aqui." : "Nada por aqui ainda. Abra um lugar e toque em Quero ir ou no coração."}</p>}
    </>}
  </section>;
}

/* ---------------- Perfil ---------------- */

function ProfileScreen({ user, name, onOpen, onLogin, onSignOut, notify }: { user: User | null; name: string; onOpen: (id: string) => void; onLogin: () => void; onSignOut: () => void; notify: (m: string) => void }) {
  const exps = useQuery({ queryKey: ["experiences", "mine", user?.id], queryFn: () => loadExperiences({ userId: user!.id }), enabled: !!user });
  const saved = useSaved(user);
  const [view, setView] = useState<"lista" | "mapa" | "fotos" | "livros">("lista");
  const list = exps.data ?? [];
  const visited = new Set(list.map((e) => e.place_id)).size;
  const photos = list.flatMap((e) => e.photos);
  const markers = useMemo<MapMarker[]>(() => {
    const seen = new Set<string>();
    return list.filter((e) => e.place?.lat != null && !seen.has(e.place_id) && seen.add(e.place_id)).map((e) => ({ id: e.place_id, lat: e.place!.lat!, lng: e.place!.lng!, category: e.category, label: e.place!.name }));
  }, [list]);
  if (!user) return <section className="h-full overflow-y-auto pt-[max(1.25rem,env(safe-area-inset-top))]"><h1 className="px-5 font-display text-[1.75rem] font-black">Perfil</h1><LoginPrompt onLogin={onLogin} text="Entre para ver suas experiências, fotos e o mapa dos lugares onde você foi." /></section>;
  return <section className="h-full overflow-y-auto pb-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
    <div className="flex items-center justify-between px-5"><Logo size="sm" /><Button variant="ghost" size="icon" aria-label="Sair" onClick={onSignOut} className="rounded-full"><LogOut size={20} /></Button></div>
    <div className="mt-5 flex items-center gap-4 px-5">
      <div className="grid size-20 place-items-center rounded-full bg-primary font-display text-3xl font-black text-primary-foreground ring-4 ring-secondary/30">{(name || "?").charAt(0).toUpperCase()}</div>
      <div className="min-w-0"><h1 className="truncate font-display text-2xl font-black">{name || "Explorador"}</h1><p className="truncate text-sm text-muted-foreground">{user.email}</p></div>
    </div>
    <div className="mx-5 mt-5 grid grid-cols-3 rounded-2xl bg-card py-4 text-center shadow-sm">
      <div><p className="font-display text-2xl font-black text-primary">{visited}</p><p className="text-[11px] font-bold text-muted-foreground">lugares visitados</p></div>
      <div className="border-x border-border"><p className="font-display text-2xl font-black text-primary">{photos.length}</p><p className="text-[11px] font-bold text-muted-foreground">minhas fotos</p></div>
      <div><p className="font-display text-2xl font-black text-primary">{saved.data?.length ?? 0}</p><p className="text-[11px] font-bold text-muted-foreground">salvos</p></div>
    </div>
    <div className="mt-6 flex items-center justify-between px-5"><h2 className="font-display text-xl font-black">Minhas experiências</h2></div>
    <div className="mt-3 flex gap-2 px-5">{([["lista", "Lista"], ["mapa", "Mapa"], ["fotos", "Fotos"], ["livros", "📚 Livros"]] as const).map(([k, l]) => <button key={k} onClick={() => setView(k)} className={`rounded-full px-4 py-2 text-sm font-bold ${view === k ? "bg-primary text-primary-foreground" : "bg-card shadow-sm"}`}>{l}</button>)}</div>
    <div key={view} className="mt-4 animate-tab-in px-5">
      {view === "lista" && (list.length ? <div className="space-y-3">{list.map((e) => <ExperienceCard key={e.id} exp={e} own showPlace onOpen={() => onOpen(e.place_id)} />)}</div> : <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Você ainda não registrou nenhuma experiência. Toque no + para começar.</p>)}
      {view === "livros" && <BooksPanel user={user} notify={notify} />}
      {view === "mapa" && <MapView center={GOIANIA} markers={markers} onSelect={onOpen} className="h-80 overflow-hidden rounded-2xl" />}
      {view === "fotos" && (photos.length ? <div className="grid grid-cols-3 gap-1.5">{photos.map((u) => <img key={u} src={u} alt="Minha foto" className="aspect-square w-full rounded-lg object-cover" />)}</div> : <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Fotos das suas experiências aparecem aqui.</p>)}
    </div>
  </section>;
}

/* ---------------- Registrar experiência ---------------- */

function ExperienceModal({ user, center, location, initialPlace, initialStall, editing = null, onLocate, onClose, onSaved, notify }: { user: User; center: LatLng; location: LatLng | null; initialPlace: PlaceSummary | null; initialStall: Stall | null; editing?: Experience | null; onLocate: () => void; onClose: () => void; onSaved: () => void; notify: (m: string) => void }) {
  const ensurePlaceFn = useServerFn(ensurePlace);
  const [step, setStep] = useState<"where" | "how">(initialPlace ? "how" : "where");
  const [mode, setMode] = useState<"near" | "search" | "map">("near");
  const [input, setInput] = useState(""); const [query, setQuery] = useState("");
  const [place, setPlace] = useState<PlaceSummary | null>(initialPlace);
  const [mapSel, setMapSel] = useState<string | null>(null);
  const [rating, setRating] = useState(editing?.rating ?? 0);
  const [scores, setScores] = useState<Record<string, number>>(() => Object.fromEntries((editing?.scores ?? []).map((s) => [s.criterion, s.score])));
  const [comment, setComment] = useState(editing?.comment ?? "");
  const [wouldReturn, setWouldReturn] = useState(editing?.would_return ?? true);
  const [isPublic, setIsPublic] = useState(editing?.is_public ?? false);
  const [kept, setKept] = useState(editing?.photoItems ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const results = usePlaces(user, center, null, mode === "search" ? query : "");
  const markers = useMemo<MapMarker[]>(() => (results.data ?? []).map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, category: p.category, label: p.name })), [results.data]);

  const pick = (p: PlaceSummary) => { setPlace(p); setScores({}); setStep("how"); };
  const addFiles = (e: ChangeEvent<HTMLInputElement>) => { const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024); setFiles((cur) => [...cur, ...picked].slice(0, 5)); e.target.value = ""; };

  const submit = async () => {
    if (!place || !rating) return;
    setSaving(true);
    if (editing) {
      try {
        const { error } = await supabase.from("experiences").update({ rating, comment: comment.trim() || null, would_return: wouldReturn, is_public: isPublic }).eq("id", editing.id).eq("user_id", user.id);
        if (error) throw error;
        await supabase.from("experience_scores").delete().eq("experience_id", editing.id);
        const scoreRows = Object.entries(scores).map(([criterion, score]) => ({ experience_id: editing.id, criterion, score }));
        if (scoreRows.length) await supabase.from("experience_scores").insert(scoreRows);
        const removed = editing.photoItems.filter((p) => !kept.some((k) => k.path === p.path)).map((p) => p.path);
        if (removed.length) { await supabase.from("experience_photos").delete().eq("experience_id", editing.id).in("storage_path", removed); await supabase.storage.from("experience-photos").remove(removed); }
        for (const [i, f] of files.entries()) {
          const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
          const path = `${user.id}/${editing.id}/${Date.now()}-${i}.${ext}`;
          const up = await supabase.storage.from("experience-photos").upload(path, f, { contentType: f.type });
          if (!up.error) await supabase.from("experience_photos").insert({ experience_id: editing.id, user_id: user.id, storage_path: path });
        }
        onSaved();
      } catch { notify("Não foi possível atualizar. Tente de novo."); } finally { setSaving(false); }
      return;
    }
    try {
      await ensurePlaceFn({ data: { placeId: place.id } });
      const { data: exp, error } = await supabase.from("experiences").insert({ user_id: user.id, place_id: place.id, category: place.category, rating, comment: comment.trim() || null, would_return: wouldReturn, stall_id: initialStall?.id ?? null }).select("id").single();
      if (error || !exp) throw error ?? new Error("insert");
      const scoreRows = Object.entries(scores).map(([criterion, score]) => ({ experience_id: exp.id, criterion, score }));
      if (scoreRows.length) await supabase.from("experience_scores").insert(scoreRows);
      for (const [i, f] of files.entries()) {
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${user.id}/${exp.id}/${Date.now()}-${i}.${ext}`;
        const up = await supabase.storage.from("experience-photos").upload(path, f, { contentType: f.type });
        if (!up.error) await supabase.from("experience_photos").insert({ experience_id: exp.id, user_id: user.id, storage_path: path });
      }
      await supabase.from("saved_places").upsert({ user_id: user.id, place_id: place.id, list: "ja_fui" }, { onConflict: "user_id,place_id,list", ignoreDuplicates: true });
      onSaved();
    } catch {
      notify("Não foi possível registrar. Tente de novo.");
    } finally { setSaving(false); }
  };

  return <div className="absolute inset-0 z-40 flex items-end bg-foreground/40" onClick={onClose}>
    <div className="flex max-h-[94%] w-full animate-modal-in flex-col rounded-t-[1.75rem] bg-background" onClick={(e) => e.stopPropagation()}>
      <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
        {step === "how" && !initialPlace ? <button aria-label="Voltar" onClick={() => setStep("where")}><ArrowLeft size={22} /></button> : <span className="w-[22px]" />}
        <h2 className="font-display text-lg font-black">{editing ? "Editar experiência" : "Registrar experiência"}</h2>
        <button aria-label="Fechar" onClick={onClose}><X size={22} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {step === "where" && <div className="animate-tab-in">
          <h3 className="mt-2 font-display text-2xl font-black">Onde você foi?</h3>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {([["near", "Usar minha localização", Crosshair], ["search", "Pesquisar lugar", Search], ["map", "Escolher no mapa", MapIcon]] as const).map(([k, l, Icon]) => <button key={k} onClick={() => { setMode(k); if (k === "near") onLocate(); }} className={`flex flex-col items-center gap-2 rounded-2xl p-3 text-center text-[11px] font-extrabold leading-tight ${mode === k ? "bg-primary text-primary-foreground" : "bg-card shadow-sm"}`}><Icon size={22} />{l}</button>)}
          </div>
          {mode === "near" && !location && <p className="mt-3 text-xs text-muted-foreground">Sem acesso à sua localização — mostrando lugares no centro de Goiânia.</p>}
          {mode === "search" && <form onSubmit={(e) => { e.preventDefault(); setQuery(input.trim()); }} className="mt-4 flex h-12 items-center gap-2 rounded-full border border-border bg-card px-4"><Search size={18} className="text-muted-foreground" /><input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ex.: Parque Flamboyant" className="min-w-0 flex-1 bg-transparent outline-none" /><Button type="submit" size="sm" className="rounded-full bg-primary text-primary-foreground">Buscar</Button></form>}
          {mode === "map" && <div className="relative mt-4"><MapView center={center} user={location} markers={markers} selectedId={mapSel} onSelect={setMapSel} className="h-64 overflow-hidden rounded-2xl" />{mapSel && (() => { const s = results.data?.find((p) => p.id === mapSel); return s ? <Button onClick={() => pick(s)} className="absolute inset-x-3 bottom-3 h-11 rounded-full bg-secondary font-extrabold text-secondary-foreground">Escolher {s.name}</Button> : null; })()}</div>}
          {mode !== "map" && <div className="mt-4 space-y-2">
            {results.isLoading && <><Skeleton className="h-16" /><Skeleton className="h-16" /></>}
            {results.isError && <p className="text-sm text-destructive">Não foi possível buscar lugares.</p>}
            {(mode === "near" || query) && results.data?.map((p) => <button key={p.id} onClick={() => pick(p)} className="flex w-full items-center gap-3 rounded-2xl bg-card p-2 text-left shadow-sm"><PlacePhoto src={p.photoUrl} alt={p.name} className="size-12 shrink-0 rounded-xl" /><div className="min-w-0 flex-1"><p className="truncate font-bold">{p.name}</p><p className="truncate text-xs text-muted-foreground">{emojiOf(p.category)} {p.address}</p></div><span className="text-[11px] font-bold text-muted-foreground">{formatKm(distanceKm(center, p))}</span></button>)}
          </div>}
        </div>}
        {step === "how" && place && <div className="animate-tab-in space-y-6">
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-card p-2 shadow-sm"><PlacePhoto src={place.photoUrl} alt={place.name} className="size-14 shrink-0 rounded-xl" /><div className="min-w-0"><p className="text-[11px] font-extrabold text-secondary">{emojiOf(place.category)} {place.category}</p><p className="truncate font-display font-black">{place.name}</p><p className="truncate text-xs text-muted-foreground">{initialStall ? `${initialStall.emoji} Barraquinha: ${initialStall.name}` : place.address}</p></div></div>
          <div><h3 className="font-display text-2xl font-black">Como foi?</h3><p className="mt-3 text-sm font-bold">Avaliação geral</p><div className="mt-2 flex gap-2">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${n} estrelas`} onClick={() => setRating(n)}><Star size={36} className={n <= rating ? "fill-secondary text-secondary" : "text-border"} /></button>)}</div></div>
          <div className="space-y-3">{(initialStall ? STALL_CRITERIA : criteriaFor(place.category)).map((c) => <div key={c} className="flex items-center justify-between"><span className="text-sm font-bold">{c}</span><div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${c}: ${n}`} onClick={() => setScores((s) => ({ ...s, [c]: n }))}><Star size={20} className={n <= (scores[c] ?? 0) ? "fill-primary text-primary" : "text-border"} /></button>)}</div></div>)}</div>
          <div><p className="text-sm font-bold">📸 Suas fotos</p><div className="mt-2 flex gap-2 overflow-x-auto">{kept.map((p) => <div key={p.path} className="relative shrink-0"><img src={p.url} alt="Foto atual" className="size-20 rounded-xl object-cover" /><button aria-label="Remover foto" onClick={() => setKept((k) => k.filter((x) => x.path !== p.path))} className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-foreground text-background"><X size={12} /></button></div>)}{previews.map((u, i) => <div key={u} className="relative shrink-0"><img src={u} alt={`Foto ${i + 1}`} className="size-20 rounded-xl object-cover" /><button aria-label="Remover foto" onClick={() => setFiles((f) => f.filter((_, j) => j !== i))} className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-foreground text-background"><X size={12} /></button></div>)}{files.length + kept.length < 5 && <label className="grid size-20 shrink-0 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border text-muted-foreground"><Camera size={24} /><input type="file" accept="image/*" multiple className="sr-only" onChange={addFiles} /></label>}</div></div>
          <div><p className="text-sm font-bold">📝 Sua experiência</p><textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} placeholder="O que você achou? O que pediria de novo?" className="mt-2 w-full resize-none rounded-xl border border-input bg-card p-3 text-[15px] outline-none focus:border-primary" /></div>
          <div className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm"><span className="font-display text-lg font-black">❤️ Voltaria?</span><button role="switch" aria-checked={wouldReturn} aria-label="Voltaria?" onClick={() => setWouldReturn((v) => !v)} className={`relative h-8 w-14 rounded-full transition ${wouldReturn ? "bg-primary" : "bg-border"}`}><span className={`absolute top-1 size-6 rounded-full bg-background shadow transition-all ${wouldReturn ? "left-7" : "left-1"}`} /></button></div>
          {editing ? <div className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm"><span className="flex items-center gap-1.5 text-sm font-bold"><Lock size={14} />{isPublic ? "Compartilhada com a comunidade" : "Privada: só você vê"}</span><button role="switch" aria-checked={isPublic} aria-label="Compartilhar experiência" onClick={() => setIsPublic((v) => !v)} className={`relative h-8 w-14 rounded-full transition ${isPublic ? "bg-primary" : "bg-border"}`}><span className={`absolute top-1 size-6 rounded-full bg-background shadow transition-all ${isPublic ? "left-7" : "left-1"}`} /></button></div>
          : <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock size={12} />Privada: só você vê esta experiência.</p>}
          <Button disabled={!rating || saving} onClick={() => void submit()} className="h-12 w-full rounded-full bg-secondary text-base font-extrabold text-secondary-foreground hover:bg-secondary/90">{saving ? (editing ? "Atualizando…" : "Registrando…") : (editing ? "Atualizar experiência" : "Registrar experiência")}</Button>
        </div>}
      </div>
    </div>
  </div>;
}

