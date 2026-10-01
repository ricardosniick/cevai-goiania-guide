import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft, Bell, Bookmark, Camera, Check, ChevronRight, CircleUserRound,
  Coffee, Eye, EyeOff, Heart, Hotel, LogOut, Map, MapPin, MoreHorizontal,
  Navigation, Plus, Search, Send, Share2, Star, Stethoscope, Trees, Utensils, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import goianiaHero from "@/assets/goiania-hero.jpg";
import restaurantBaru from "@/assets/restaurant-baru.jpg";
import cafeBiscoito from "@/assets/cafe-biscoito.jpg";
import parqueFlamboyant from "@/assets/parque-flamboyant.jpg";
import googleRestaurant from "@/assets/google-place-restaurant.jpg";
import googlePark from "@/assets/google-place-park.jpg";
import googleHotel from "@/assets/google-place-hotel.jpg";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import type { User } from "@supabase/supabase-js";

type Screen = "welcome" | "auth" | "home" | "map" | "detail" | "saved" | "profile";
type MainScreen = "home" | "map" | "saved" | "profile";
type Category = "Todos" | "Restaurantes" | "Cafés" | "Parques" | "Hotéis" | "Clínicas";
type Place = {
  id: string;
  name: string;
  category: Exclude<Category, "Todos">;
  area: string;
  rating: string;
  reviews: number;
  image: string;
  officialPhotos: string[];
  googlePlaceId: string;
  description: string;
  price: string;
  x: string;
  y: string;
};
type DiaryEntry = {
  id: string;
  placeId: string;
  placeName: string;
  location: string;
  category: Exclude<Category, "Todos">;
  review: string;
  rating: number;
  wouldReturn: boolean;
  photo: string | null;
  createdAt: string;
};
type ExperienceDraft = Omit<DiaryEntry, "id" | "createdAt" | "placeId">;

const categoryOptions: Array<{ name: Exclude<Category, "Todos">; icon: typeof Utensils; tone: string }> = [
  { name: "Restaurantes", icon: Utensils, tone: "bg-secondary text-secondary-foreground" },
  { name: "Cafés", icon: Coffee, tone: "bg-amber-100 text-amber-800" },
  { name: "Parques", icon: Trees, tone: "bg-emerald-100 text-emerald-700" },
  { name: "Hotéis", icon: Hotel, tone: "bg-sky-100 text-sky-700" },
  { name: "Clínicas", icon: Stethoscope, tone: "bg-rose-100 text-rose-700" },
];

const places: Place[] = [
  { id: "baru", googlePlaceId: "ChIJ-simulado-baru-goiania", name: "Baru Restobar", category: "Restaurantes", area: "Setor Marista", rating: "4.8", reviews: 321, image: googleRestaurant, officialPhotos: [googleRestaurant, restaurantBaru, cafeBiscoito], description: "Cozinha brasileira contemporânea, ingredientes do cerrado e um ambiente acolhedor no coração do Marista.", price: "$$", x: "28%", y: "31%" },
  { id: "biscoito", googlePlaceId: "ChIJ-simulado-cafe-goiania", name: "Café Biscoito", category: "Cafés", area: "Setor Bueno", rating: "4.7", reviews: 184, image: cafeBiscoito, officialPhotos: [cafeBiscoito, googleRestaurant], description: "Cafés especiais, receitas artesanais e um clima tranquilo para desacelerar no Setor Bueno.", price: "$", x: "59%", y: "42%" },
  { id: "flamboyant", googlePlaceId: "ChIJ-simulado-parque-goiania", name: "Parque Flamboyant", category: "Parques", area: "Jardim Goiás", rating: "4.9", reviews: 508, image: googlePark, officialPhotos: [googlePark, parqueFlamboyant, goianiaHero], description: "Lagos, pistas para caminhada e muito verde para curtir o fim de tarde em Goiânia.", price: "Grátis", x: "76%", y: "27%" },
  { id: "hotel", googlePlaceId: "ChIJ-simulado-hotel-goiania", name: "Hotel Marista", category: "Hotéis", area: "Setor Marista", rating: "4.6", reviews: 230, image: googleHotel, officialPhotos: [googleHotel, goianiaHero], description: "Hospedagem confortável com vista para a cidade e localização central.", price: "$$$", x: "39%", y: "60%" },
  { id: "vaca-brava", googlePlaceId: "ChIJ-simulado-vacabrava-goiania", name: "Parque Vaca Brava", category: "Parques", area: "Setor Bueno", rating: "4.8", reviews: 642, image: parqueFlamboyant, officialPhotos: [parqueFlamboyant, googlePark], description: "Um dos cartões-postais verdes de Goiânia, com lago, pista de caminhada e natureza no Setor Bueno.", price: "Grátis", x: "62%", y: "56%" },
  { id: "clinica", googlePlaceId: "ChIJ-simulado-clinica-goiania", name: "Clínica Marista", category: "Clínicas", area: "Setor Marista", rating: "4.7", reviews: 118, image: googleHotel, officialPhotos: [googleHotel, goianiaHero], description: "Espaço de cuidado e bem-estar com atendimento especializado no Setor Marista.", price: "$$", x: "70%", y: "67%" },
];

const initialPlace: Place = places[0] ?? {
  id: "baru",
  name: "Restaurante Baru",
  category: "Restaurantes",
  area: "Setor Marista",
  rating: "4.8",
  reviews: 321,
  image: restaurantBaru,
  officialPhotos: [restaurantBaru],
  googlePlaceId: "ChIJ-simulado-baru-goiania",
  description: "Cozinha brasileira contemporânea no coração do Marista.",
  price: "$$",
  x: "28%",
  y: "31%",
};

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Cê Vai? — Descubra Goiânia" },
    { name: "description", content: "Seu guia para descobrir, salvar e registrar os melhores lugares de Goiânia." },
    { property: "og:title", content: "Cê Vai? — Descubra Goiânia" },
    { property: "og:description", content: "Seu guia para descobrir, salvar e registrar os melhores lugares de Goiânia." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: CeVaiApp,
});

function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return <div className={`font-display font-black tracking-normal ${compact ? "text-3xl" : "text-6xl"} ${light ? "text-primary-foreground" : "text-primary"}`}>Cê <span className="text-secondary">Vai<span className="inline-block rotate-6">?</span></span></div>;
}

function StatusBar({ light = false }: { light?: boolean }) {
  return <div className={`absolute inset-x-0 top-0 z-30 flex h-11 items-center justify-between px-6 text-[11px] font-extrabold ${light ? "text-primary-foreground" : "text-foreground"}`}><span>9:41</span><span className="tracking-widest">● ◒ ▰</span></div>;
}

function CeVaiApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [previousScreen, setPreviousScreen] = useState<MainScreen>("home");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>("Todos");
  const [selectedPlace, setSelectedPlace] = useState<Place>(initialPlace);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [profileName, setProfileName] = useState("Ricardo");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("ce-vai-diary");
      if (stored) setDiaryEntries(JSON.parse(stored) as DiaryEntry[]);
    } catch {
      window.localStorage.removeItem("ce-vai-diary");
    }
  }, []);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const notify = (message: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(""), 1800);
  };
  const go = (next: Screen, backwards = false) => {
    setDirection(backwards ? "back" : "forward");
    setScreen(next);
  };
  const openDetail = (place: Place, from: MainScreen) => {
    setSelectedPlace(place);
    setPreviousScreen(from);
    go("detail");
  };
  const toggleSaved = (place: Place) => {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(place.id)) next.delete(place.id); else next.add(place.id);
      return next;
    });
    notify(savedIds.has(place.id) ? "Removido dos salvos" : "Lugar salvo!");
  };
  const publishExperience = (draft: ExperienceDraft) => {
    const matchedPlace = places.find((place) => place.name.toLocaleLowerCase() === draft.placeName.trim().toLocaleLowerCase()) ?? selectedPlace;
    const entry: DiaryEntry = { ...draft, id: `${Date.now()}`, placeId: matchedPlace.id, createdAt: new Date().toISOString() };
    const nextEntries = [entry, ...diaryEntries];
    setDiaryEntries(nextEntries);
    window.localStorage.setItem("ce-vai-diary", JSON.stringify(nextEntries));
    setModalOpen(false);
    notify("Experiência salva no seu diário!");
  };
  const saveProfile = async (nextUser: User, fullName: string) => {
    setUser(nextUser);
    setProfileName(fullName || nextUser.user_metadata?.full_name || nextUser.email?.split("@")[0] || "Explorador");
    const { error } = await supabase.from("profiles").upsert({ user_id: nextUser.id, full_name: fullName || nextUser.user_metadata?.full_name || "" }, { onConflict: "user_id" });
    if (error) notify("Conta criada, mas o perfil não foi atualizado.");
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    go("welcome", true);
  };

  return (
    <main className="min-h-dvh bg-primary/5 p-0 sm:grid sm:place-items-center sm:p-7">
      <div className="relative h-dvh w-full overflow-hidden bg-background sm:h-[852px] sm:max-h-[calc(100vh-3.5rem)] sm:w-[393px] sm:rounded-[2.6rem] sm:border-[7px] sm:border-foreground sm:shadow-2xl">
        <div key={screen} className={direction === "back" ? "animate-screen-back" : "animate-screen-in"}>
          {screen === "welcome" && <WelcomeScreen onAuth={() => go("auth")} onExplore={() => go("home")} />}
          {screen === "auth" && <AuthScreen onBack={() => go("welcome", true)} onSuccess={(nextUser, name) => { void saveProfile(nextUser, name); go("home"); }} notify={notify} />}
          {screen === "home" && <HomeScreen activeCategory={activeCategory} savedIds={savedIds} onCategory={setActiveCategory} onDetail={(place) => openDetail(place, "home")} onNavigate={(next) => go(next)} onSave={toggleSaved} onAdd={() => setModalOpen(true)} />}
          {screen === "map" && <MapScreen active={activeCategory} onCategory={setActiveCategory} onNavigate={(next) => go(next)} onAdd={() => setModalOpen(true)} onDetail={(place) => openDetail(place, "map")} />}
          {screen === "detail" && <DetailScreen place={selectedPlace} communityEntries={diaryEntries.filter((entry) => entry.placeId === selectedPlace.id)} saved={savedIds.has(selectedPlace.id)} onBack={() => go(previousScreen, true)} onSave={() => toggleSaved(selectedPlace)} onGo={() => notify("Adicionado à sua lista")} onShare={() => notify("Link do lugar copiado!")} />}
          {screen === "saved" && <SavedScreen savedPlaces={places.filter((place) => savedIds.has(place.id))} onNavigate={(next) => go(next)} onAdd={() => setModalOpen(true)} onDetail={(place) => openDetail(place, "saved")} onSave={toggleSaved} />}
          {screen === "profile" && <ProfileScreen name={profileName} email={user?.email ?? null} savedCount={savedIds.size} diaryEntries={diaryEntries} onNavigate={(next) => go(next)} onAdd={() => setModalOpen(true)} onSignOut={user ? signOut : () => go("auth")} />}
        </div>
        {modalOpen && <ExperienceModal initialPlace={selectedPlace} onClose={() => setModalOpen(false)} onPublish={publishExperience} />}
        {toast && <div role="status" className="absolute bottom-24 left-1/2 z-50 flex -translate-x-1/2 animate-toast-in items-center gap-2 whitespace-nowrap rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background shadow-xl"><Check size={16} />{toast}</div>}
      </div>
    </main>
  );
}

function WelcomeScreen({ onAuth, onExplore }: { onAuth: () => void; onExplore: () => void }) {
  return <section className="relative h-dvh min-h-0 overflow-y-auto bg-primary sm:h-[838px]"><StatusBar light /><div className="relative flex min-h-full flex-col justify-end"><img src={goianiaHero} width={768} height={1376} className="absolute inset-0 h-full w-full object-cover" alt="Vista aérea de Goiânia ao pôr do sol" /><div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-primary/20 to-primary/90" /><div className="relative z-10 flex min-h-[610px] flex-col justify-end px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16 text-center text-primary-foreground"><Logo light /><p className="mx-auto mt-4 max-w-xs font-display text-lg font-extrabold leading-snug">O mapa das suas escolhas.</p><p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-primary-foreground/85">Onde você foi e se vale a pena voltar.</p><div className="mt-7 space-y-3"><Button onClick={onAuth} className="h-12 w-full rounded-full bg-primary text-primary-foreground shadow-lg">Criar conta</Button><Button variant="outline" onClick={onAuth} className="h-12 w-full rounded-full border-primary-foreground/50 bg-background/90 text-primary backdrop-blur">Entrar</Button><Button variant="ghost" onClick={onExplore} className="h-9 text-xs text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">Explorar sem entrar</Button></div></div></div></section>;
}

function AuthScreen({ onBack, onSuccess, notify }: { onBack: () => void; onSuccess: (user: User, name: string) => void; notify: (message: string) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } } });
      setLoading(false);
      if (error) return notify(error.message);
      if (!data.session) return notify("Confira seu e-mail para confirmar a conta.");
      if (data.user) onSuccess(data.user, fullName);
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return notify("E-mail ou senha inválidos.");
    onSuccess(data.user, data.user.user_metadata?.full_name ?? "");
  };
  const googleSignIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) notify("Não foi possível entrar com Google.");
    if (result.redirected) return;
    const { data } = await supabase.auth.getUser();
    if (data.user) onSuccess(data.user, data.user.user_metadata?.full_name ?? "");
  };
  return <section className="h-dvh overflow-y-auto bg-background px-5 pb-8 pt-12 sm:h-[838px]"><StatusBar /><Button variant="ghost" size="icon" aria-label="Voltar" onClick={onBack} className="rounded-full"><ArrowLeft /></Button><div className="mx-auto mt-4 max-w-sm"><Logo compact /><h1 className="mt-8 font-display text-3xl font-black">{mode === "login" ? "Bem-vindo de volta" : "Crie seu mapa"}</h1><p className="mt-2 text-sm text-muted-foreground">{mode === "login" ? "Entre para continuar suas descobertas." : "Guarde lugares, fotos e experiências em um só lugar."}</p><div className="mt-7 grid grid-cols-2 rounded-full bg-muted p-1"><Button onClick={() => setMode("login")} className={`rounded-full ${mode === "login" ? "bg-card text-primary shadow-sm hover:bg-card" : "bg-transparent text-muted-foreground shadow-none hover:bg-transparent"}`}>Entrar</Button><Button onClick={() => setMode("signup")} className={`rounded-full ${mode === "signup" ? "bg-card text-primary shadow-sm hover:bg-card" : "bg-transparent text-muted-foreground shadow-none hover:bg-transparent"}`}>Criar conta</Button></div><div className="mt-6 space-y-3">{mode === "signup" && <input value={fullName} onChange={(event) => setFullName(event.target.value)} aria-label="Nome completo" autoComplete="name" className="h-12 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Nome completo" />}<input value={email} onChange={(event) => setEmail(event.target.value)} aria-label="E-mail" autoComplete="email" type="email" className="h-12 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="E-mail" /><div className="relative"><input value={password} onChange={(event) => setPassword(event.target.value)} aria-label="Senha" autoComplete={mode === "login" ? "current-password" : "new-password"} type={showPassword ? "text" : "password"} className="h-12 w-full rounded-xl border border-input bg-card px-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Senha" /><Button variant="ghost" size="icon" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 rounded-full text-muted-foreground">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</Button></div><Button disabled={loading || !email || password.length < 6 || (mode === "signup" && !fullName.trim())} onClick={() => void submit()} className="h-12 w-full rounded-full bg-primary text-primary-foreground">{loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</Button></div><div className="my-5 flex items-center gap-3 text-[10px] text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div><Button variant="outline" onClick={() => void googleSignIn()} className="h-12 w-full rounded-full border-border bg-card text-foreground"><span className="mr-2 text-base font-black text-secondary">G</span>Entrar com Google</Button></div></section>;
}

function HomeScreen({ activeCategory, savedIds, onCategory, onDetail, onNavigate, onSave, onAdd }: { activeCategory: Category; savedIds: Set<string>; onCategory: (category: Category) => void; onDetail: (place: Place) => void; onNavigate: (screen: MainScreen) => void; onSave: (place: Place) => void; onAdd: () => void }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => places.filter((place) => (activeCategory === "Todos" || place.category === activeCategory) && place.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [activeCategory, query]);
  return <section className="h-dvh overflow-y-auto pb-24 pt-12 sm:h-[838px]"><StatusBar /><header className="flex items-center justify-between px-5"><Logo compact /><Bell size={21} className="text-primary" fill="currentColor" /></header><div className="mx-5 mt-4 flex h-11 items-center gap-3 rounded-full border border-border bg-card px-4 shadow-sm"><Search size={17} className="text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar lugares" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="O que você vai descobrir hoje?" /><MoreHorizontal size={17} /></div>
    <div className="mt-5 flex justify-between px-3">{categoryOptions.map(({ name, icon: Icon, tone }) => <Button variant="ghost" key={name} onClick={() => onCategory(activeCategory === name ? "Todos" : name)} className={`h-auto min-w-0 flex-col gap-1.5 rounded-xl px-1 py-1 text-[10px] font-bold ${activeCategory === name ? "text-primary" : "text-foreground"}`}><span className={`grid size-12 place-items-center rounded-full transition-transform ${tone} ${activeCategory === name ? "scale-110 ring-2 ring-primary ring-offset-2" : ""}`}><Icon size={21} /></span>{name}</Button>)}</div>
    <div className="mt-7 flex items-center justify-between px-5"><h1 className="font-display text-xl font-black">{activeCategory === "Todos" ? "Destaques da semana" : activeCategory}</h1><Button variant="ghost" onClick={() => onCategory("Todos")} className="h-8 gap-1 px-1 text-xs text-primary">{activeCategory === "Todos" ? "Ver todos" : "Limpar"}<ChevronRight size={14} /></Button></div>
    <div className="mx-5 mt-3 grid gap-3">{visible.length ? visible.map((place, index) => <PlaceCard key={place.id} place={place} featured={index === 0} saved={savedIds.has(place.id)} onOpen={() => onDetail(place)} onSave={() => onSave(place)} />) : <EmptyState title="Nenhum lugar encontrado" text="Tente outra categoria ou busca." />}</div>
    <BottomNav active="home" onNavigate={onNavigate} onAdd={onAdd} />
  </section>;
}

function PlaceCard({ place, featured, saved, onOpen, onSave }: { place: Place; featured?: boolean; saved: boolean; onOpen: () => void; onSave: () => void }) {
  return <article className={`overflow-hidden rounded-2xl bg-card shadow-sm ${featured ? "shadow-md" : "grid grid-cols-[104px_1fr]"}`}><Button variant="ghost" aria-label={`Abrir ${place.name}`} onClick={onOpen} className={`relative block h-auto w-full overflow-hidden rounded-none p-0 ${featured ? "h-40" : "h-full min-h-28"}`}><img src={place.image} width={1200} height={704} loading="lazy" alt={place.name} className="h-full w-full object-cover" />{featured && <span className="absolute left-3 top-3 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-secondary-foreground">Em alta</span>}</Button><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3"><Button variant="ghost" onClick={onOpen} className="h-auto min-w-0 justify-start whitespace-normal p-0 text-left hover:bg-transparent"><span className="min-w-0"><strong className="block truncate font-display text-sm font-extrabold">{place.name}</strong><span className="mt-1 flex items-center gap-1 text-[11px]"><Star size={12} className="fill-secondary text-secondary" /><b>{place.rating}</b><span className="truncate text-muted-foreground">• {place.area}</span></span></span></Button><Button variant="ghost" size="icon" aria-label={saved ? "Remover dos salvos" : "Salvar lugar"} onClick={onSave} className="rounded-full bg-muted text-secondary"><Heart size={19} fill={saved ? "currentColor" : "none"} /></Button></div></article>;
}

function BottomNav({ active, onNavigate, onAdd }: { active: MainScreen; onNavigate: (screen: MainScreen) => void; onAdd: () => void }) {
  const items: Array<{ key: MainScreen; label: string; icon: typeof MapPin }> = [{ key: "home", label: "Explorar", icon: MapPin }, { key: "map", label: "Mapa", icon: Map }, { key: "saved", label: "Salvos", icon: Heart }, { key: "profile", label: "Perfil", icon: CircleUserRound }];
  return <nav className="absolute inset-x-0 bottom-0 z-20 grid h-[78px] grid-cols-5 items-center border-t border-border bg-background/95 px-3 pb-2 backdrop-blur">{items.slice(0, 2).map(({ key, label, icon: Icon }) => <NavItem key={key} active={active === key} label={label} Icon={Icon} onClick={() => onNavigate(key)} />)}<Button aria-label="Registrar experiência" onClick={onAdd} className="mx-auto size-14 -translate-y-3 rounded-full bg-primary p-0 text-primary-foreground shadow-lg"><Plus className="size-7" /></Button>{items.slice(2).map(({ key, label, icon: Icon }) => <NavItem key={key} active={active === key} label={label} Icon={Icon} onClick={() => onNavigate(key)} />)}</nav>;
}

function NavItem({ active, label, Icon, onClick }: { active: boolean; label: string; Icon: typeof MapPin; onClick: () => void }) {
  return <Button variant="ghost" onClick={onClick} aria-current={active ? "page" : undefined} className={`h-auto flex-col gap-1 rounded-xl px-1 py-1 text-[9px] font-bold ${active ? "text-primary" : "text-muted-foreground"}`}><Icon size={20} fill={active && (label === "Explorar" || label === "Salvos") ? "currentColor" : "none"} />{label}</Button>;
}

function MapScreen({ active, onCategory, onNavigate, onAdd, onDetail }: { active: Category; onCategory: (category: Category) => void; onNavigate: (screen: MainScreen) => void; onAdd: () => void; onDetail: (place: Place) => void }) {
  const visible = places.filter((place) => active === "Todos" || place.category === active);
  const firstVisible = visible[0];
  return <section className="relative h-dvh overflow-hidden bg-muted pt-12 sm:h-[838px]"><StatusBar /><div className="map-pattern absolute inset-0 opacity-70" /><div className="absolute left-[-20%] top-[47%] h-10 w-[150%] rotate-[-16deg] bg-sky-100/70" /><div className="relative z-10 mx-4 flex h-11 items-center gap-2 rounded-full bg-card px-4 shadow-lg"><Search size={17} /><input aria-label="Buscar nesta área" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Buscar nesta área" /><Navigation size={17} className="text-primary" /></div><div className="relative z-10 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">{(["Todos", ...categoryOptions.map((item) => item.name)] as Category[]).map((cat) => <Button key={cat} onClick={() => onCategory(cat)} className={`h-8 shrink-0 rounded-full px-3 text-[11px] ${active === cat ? "bg-primary text-primary-foreground" : "bg-card text-foreground shadow-sm hover:bg-card"}`}>{cat}</Button>)}</div>
    {visible.map((place) => { const category = categoryOptions.find((item) => item.name === place.category); const Icon = category?.icon ?? MapPin; return <Button key={place.id} aria-label={`Abrir ${place.name}`} onClick={() => onDetail(place)} style={{ left: place.x, top: place.y }} className="absolute z-10 h-auto -translate-x-1/2 flex-col gap-0 bg-transparent p-0 text-[10px] text-foreground shadow-none hover:bg-transparent"><span className={`grid size-10 place-items-center rounded-full border-2 border-background text-primary-foreground shadow-lg ${category?.tone ?? "bg-primary"}`}><Icon size={17} /></span><span className="mt-1 max-w-24 rounded bg-background/85 px-1.5 py-0.5 leading-tight backdrop-blur">{place.area}</span></Button>; })}
    {firstVisible && <Button variant="ghost" onClick={() => onDetail(firstVisible)} className="absolute bottom-24 left-4 right-20 z-10 h-auto justify-start gap-3 rounded-2xl bg-card p-2 text-left shadow-lg hover:bg-card"><img src={firstVisible.image} alt="" className="size-14 rounded-xl object-cover" /><span className="min-w-0"><b className="block truncate text-xs">{firstVisible.name}</b><small className="text-muted-foreground">★ {firstVisible.rating} · {firstVisible.area}</small></span></Button>}<Button aria-label="Minha localização" className="absolute bottom-24 right-4 z-10 size-12 rounded-full bg-card p-0 text-primary shadow-lg hover:bg-card"><Navigation size={20} /></Button><BottomNav active="map" onNavigate={onNavigate} onAdd={onAdd} />
  </section>;
}

function DetailScreen({ place, communityEntries, saved, onBack, onSave, onGo, onShare }: { place: Place; communityEntries: DiaryEntry[]; saved: boolean; onBack: () => void; onSave: () => void; onGo: () => void; onShare: () => void }) {
  const [tab, setTab] = useState("Sobre");
  return <section className="h-dvh overflow-y-auto bg-background pb-24 sm:h-[838px]"><StatusBar light /><div className="relative h-64"><img src={place.image} width={1200} height={704} alt={place.name} className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-b from-foreground/30 to-transparent" /><div className="absolute left-4 right-4 top-12 flex justify-between"><Button variant="ghost" size="icon" aria-label="Voltar" onClick={onBack} className="rounded-full bg-background/90 text-foreground hover:bg-background"><ArrowLeft size={20} /></Button><div className="flex gap-2"><Button variant="ghost" size="icon" aria-label="Compartilhar" onClick={onShare} className="rounded-full bg-background/90 text-foreground hover:bg-background"><Share2 size={18} /></Button><Button variant="ghost" size="icon" aria-label="Mais opções" className="rounded-full bg-background/90 text-foreground hover:bg-background"><MoreHorizontal size={20} /></Button></div></div></div>
    <div className="px-5 pt-5"><div className="flex items-start justify-between gap-3"><div><h1 className="font-display text-2xl font-black">{place.name}</h1><p className="mt-1 flex items-center gap-1 text-sm"><Star size={15} className="fill-secondary text-secondary" /><b>{place.rating}</b> ({place.reviews} avaliações)</p></div><Button variant="ghost" onClick={onGo} className="h-auto rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-primary hover:bg-emerald-50">Ver no mapa</Button></div><p className="mt-2 text-xs text-muted-foreground">{place.price} · {place.category.replace(/s$/, "")} · {place.area}</p></div>
    <div className="mt-5 flex overflow-x-auto border-b border-border px-4 [scrollbar-width:none]">{["Sobre", "Avaliações", "Fotos Oficiais", "Fotos dos Usuários"].map((name) => <Button variant="ghost" key={name} onClick={() => setTab(name)} className={`h-11 shrink-0 rounded-none border-b-2 px-3 text-[11px] hover:bg-transparent ${tab === name ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{name}</Button>)}</div><DetailTab key={tab} tab={tab} place={place} communityEntries={communityEntries} />
    <div className="absolute inset-x-0 bottom-0 z-20 grid h-[76px] grid-cols-[1fr_1.2fr] gap-3 border-t border-border bg-background px-4 py-3"><Button variant="outline" onClick={onSave} className="gap-2 rounded-full border-primary text-primary"><Bookmark size={18} fill={saved ? "currentColor" : "none"} />{saved ? "Salvo" : "Salvar"}</Button><Button onClick={onGo} className="gap-2 rounded-full bg-primary text-primary-foreground"><Check size={17} />Voltaria?</Button></div>
  </section>;
}

function DetailTab({ tab, place, communityEntries }: { tab: string; place: Place; communityEntries: DiaryEntry[] }) {
  const communityPhotos = communityEntries.filter((entry) => entry.photo);
  return <div className="animate-tab-in px-5 py-5">{tab === "Sobre" && <><p className="text-sm leading-relaxed">{place.description}</p><div className="mt-5 rounded-2xl bg-card p-4 shadow-sm"><b className="text-sm">Informações</b><p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><MapPin size={15} />{place.area}, Goiânia</p><p className="mt-2 text-[10px] text-muted-foreground">Dados simulados no formato Google Places · ID {place.googlePlaceId}</p></div></>}{tab === "Avaliações" && <><h2 className="font-display text-base font-black">O que estão dizendo</h2><div className="mt-3 flex gap-3 rounded-2xl bg-card p-4 shadow-sm"><div className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary/20 font-black text-secondary">M</div><div><p className="text-xs font-bold">Mariana S.</p><p className="mt-1 text-xs text-secondary">★★★★★ <span className="text-muted-foreground">há 3 dias</span></p><p className="mt-2 text-xs">Experiência incrível e ambiente muito agradável!</p></div></div></>}{tab === "Fotos Oficiais" && <div><div className="flex items-center justify-between"><h2 className="font-display text-base font-black">Fotos Oficiais</h2><span className="rounded-full bg-muted px-2 py-1 text-[9px] font-bold text-muted-foreground">Google</span></div><div className="mt-3 grid grid-cols-2 gap-2">{place.officialPhotos.map((photo, index) => <img key={photo} src={photo} loading="lazy" width={1200} height={800} alt={`Foto oficial ${index + 1} de ${place.name}`} className={`${index === 0 ? "col-span-2 aspect-[2/1]" : "aspect-square"} w-full rounded-xl object-cover`} />)}</div></div>}{tab === "Fotos dos Usuários" && (communityPhotos.length ? <div className="grid grid-cols-2 gap-2">{communityPhotos.map((entry) => <figure key={entry.id} className="overflow-hidden rounded-xl bg-card"><img src={entry.photo ?? ""} alt={`Registro da comunidade em ${place.name}`} className="aspect-square w-full object-cover" /><figcaption className="p-2 text-[10px] text-muted-foreground">Seu diário · {entry.rating} ★</figcaption></figure>)}</div> : <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">As fotos registradas pelos usuários aparecem aqui.</p>)}</div>;
}

function Tip({ initials, text }: { initials: string; text: string }) { return <div className="flex gap-3 rounded-2xl bg-card p-4 shadow-sm"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">{initials}</span><p className="pt-1 text-sm">{text}</p></div>; }

function SavedScreen({ savedPlaces, onNavigate, onAdd, onDetail, onSave }: { savedPlaces: Place[]; onNavigate: (screen: MainScreen) => void; onAdd: () => void; onDetail: (place: Place) => void; onSave: (place: Place) => void }) {
  return <section className="h-dvh overflow-y-auto pb-24 pt-12 sm:h-[838px]"><StatusBar /><header className="px-5"><Logo compact /><h1 className="mt-6 font-display text-2xl font-black">Seus lugares salvos</h1><p className="mt-1 text-sm text-muted-foreground">Volte quando quiser aos seus favoritos.</p></header><div className="mx-5 mt-5 grid gap-3">{savedPlaces.length ? savedPlaces.map((place) => <PlaceCard key={place.id} place={place} saved onOpen={() => onDetail(place)} onSave={() => onSave(place)} />) : <EmptyState title="Nada salvo ainda" text="Toque no coração de um lugar para encontrá-lo aqui." />}</div><BottomNav active="saved" onNavigate={onNavigate} onAdd={onAdd} /></section>;
}

function ProfileScreen({ name, email, savedCount, diaryEntries, onNavigate, onAdd, onSignOut }: { name: string; email: string | null; savedCount: number; diaryEntries: DiaryEntry[]; onNavigate: (screen: MainScreen) => void; onAdd: () => void; onSignOut: () => void }) {
  const initial = name.trim().charAt(0).toLocaleUpperCase() || "C";
  return <section className="h-dvh overflow-y-auto pb-24 pt-12 sm:h-[838px]"><StatusBar /><header className="grid grid-cols-[minmax(0,1fr)_auto] items-center px-5"><Logo compact /><Button variant="ghost" size="icon" aria-label={email ? "Sair" : "Entrar"} onClick={onSignOut} className="shrink-0 rounded-full text-primary"><LogOut size={19} /></Button></header><div className="mt-5 flex flex-col items-center px-5 text-center"><div className="grid size-20 place-items-center rounded-full bg-primary text-2xl font-black text-primary-foreground">{initial}</div><h1 className="mt-3 max-w-full truncate font-display text-xl font-black">{name}</h1><p className="text-xs text-muted-foreground">{email ?? "Explorador de Goiânia"}</p><div className="mt-5 grid w-full grid-cols-3 divide-x divide-border rounded-2xl bg-card p-4 shadow-sm"><ProfileStat value={String(diaryEntries.length)} label="Registros" /><ProfileStat value={String(savedCount)} label="Salvos" /><ProfileStat value={String(diaryEntries.filter((entry) => entry.review).length)} label="Dicas" /></div></div><div className="mt-6 px-5"><div className="flex items-end justify-between"><h2 className="font-display text-lg font-black">Meu diário</h2><span className="text-[10px] text-muted-foreground">Só neste aparelho</span></div>{diaryEntries.length ? <div className="mt-3 grid gap-3">{diaryEntries.map((entry) => <article key={entry.id} className="grid grid-cols-[88px_1fr] overflow-hidden rounded-2xl bg-card shadow-sm">{entry.photo ? <img src={entry.photo} alt={`Experiência em ${entry.placeName}`} className="h-full min-h-24 w-full object-cover" /> : <div className="grid min-h-24 place-items-center bg-muted"><Camera className="text-muted-foreground" /></div>}<div className="min-w-0 p-3"><b className="block truncate text-sm">{entry.placeName}</b><p className="mt-1 text-[11px] text-secondary">{"★".repeat(entry.rating)}<span className="text-muted-foreground"> · {entry.wouldReturn ? "Voltaria" : "Não voltaria"}</span></p><p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{entry.review || entry.location}</p></div></article>)}</div> : <EmptyState title="Seu diário está vazio" text="Registre uma experiência pelo botão +." />}</div><BottomNav active="profile" onNavigate={onNavigate} onAdd={onAdd} /></section>;
}

function ProfileStat({ value, label }: { value: string; label: string }) { return <div><b className="block font-display text-xl text-primary">{value}</b><small className="text-muted-foreground">{label}</small></div>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center"><Heart className="mx-auto text-muted-foreground" /><b className="mt-3 block text-sm">{title}</b><p className="mt-1 text-xs text-muted-foreground">{text}</p></div>; }

function ExperienceModal({ initialPlace, onClose, onPublish }: { initialPlace: Place; onClose: () => void; onPublish: (draft: ExperienceDraft) => void }) {
  const [category, setCategory] = useState<Exclude<Category, "Todos">>(initialPlace.category);
  const [wouldReturn, setWouldReturn] = useState(true);
  const [review, setReview] = useState("");
  const [placeName, setPlaceName] = useState(initialPlace.name);
  const [location, setLocation] = useState(initialPlace.area);
  const [rating, setRating] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : null); reader.readAsDataURL(file); };
  return <div className="absolute inset-0 z-40 flex items-end bg-foreground/35 sm:items-center"><section role="dialog" aria-modal="true" aria-label="Registrar experiência" className="animate-modal-in flex h-[94%] w-full flex-col overflow-hidden rounded-t-[2rem] bg-background sm:h-full sm:rounded-none"><header className="grid h-16 shrink-0 grid-cols-[40px_1fr_40px] items-center border-b border-border px-4"><Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose} className="rounded-full"><X size={22} /></Button><h1 className="text-center font-display text-base font-black">Registrar experiência</h1></header><div className="flex-1 overflow-y-auto px-5 py-4">
    <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">{categoryOptions.map(({ name, icon: Icon, tone }) => <Button variant="ghost" key={name} onClick={() => setCategory(name)} className={`h-auto flex-col gap-1 rounded-2xl px-3 py-2 text-[9px] ${category === name ? "ring-2 ring-secondary" : ""}`}><span className={`grid size-10 place-items-center rounded-full ${tone}`}><Icon size={18} /></span>{name}</Button>)}</div>
    <label className="relative mt-3 grid h-28 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-border bg-card text-center"><input onChange={handlePhoto} type="file" accept="image/*" className="sr-only" />{photo ? <><img src={photo} alt="Prévia da foto selecionada" className="h-full w-full object-cover" /><span className="absolute rounded-full bg-background/90 px-3 py-1 text-[10px] font-bold">Trocar foto</span></> : <span><span className="mx-auto grid size-9 place-items-center rounded-full bg-background shadow"><Camera size={18} /></span><b className="mt-2 block text-xs">Adicionar foto</b><small className="text-muted-foreground">Escolha uma imagem</small></span>}</label>
    <div className="mt-4 space-y-3"><input value={placeName} onChange={(event) => setPlaceName(event.target.value)} aria-label="Nome do lugar" className="h-12 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Qual é o nome do lugar?" /><div className="relative"><input value={location} onChange={(event) => setLocation(event.target.value)} aria-label="Localização" className="h-12 w-full rounded-xl border border-input bg-card px-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Onde fica?" /><MapPin className="absolute right-4 top-4 text-muted-foreground" size={17} /></div><div className="relative"><textarea aria-label="Sua experiência" value={review} onChange={(event) => setReview(event.target.value.slice(0, 500))} className="h-28 w-full resize-none rounded-xl border border-input bg-card p-4 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Conte sua experiência..." /><span className="absolute bottom-3 right-3 text-[10px] text-muted-foreground">{review.length}/500</span></div></div>
    <div className="mt-5 flex items-center justify-between border-b border-border pb-5"><b className="text-sm">Como foi?</b><div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <Button variant="ghost" size="icon" aria-label={`${n} estrelas`} key={n} onClick={() => setRating(n)} className={`size-7 p-0 ${n <= rating ? "text-secondary" : "text-muted-foreground"}`}><Star size={21} fill={n <= rating ? "currentColor" : "none"} /></Button>)}</div></div><div className="flex items-center justify-between py-5"><div><b className="text-sm">Voltaria?</b><p className="text-[11px] text-muted-foreground">Você voltaria a este lugar?</p></div><Button role="switch" aria-checked={wouldReturn} aria-label="Voltaria" onClick={() => setWouldReturn((value) => !value)} className={`h-7 w-12 justify-start rounded-full p-1 ${wouldReturn ? "bg-primary" : "bg-muted"}`}><span className={`size-5 rounded-full bg-background shadow transition-transform ${wouldReturn ? "translate-x-5" : "translate-x-0"}`} /></Button></div>
  </div><div className="shrink-0 border-t border-border p-4"><Button disabled={!placeName.trim() || !location.trim()} onClick={() => onPublish({ placeName: placeName.trim(), location: location.trim(), category, review, rating, wouldReturn, photo })} className="h-12 w-full rounded-full bg-primary text-primary-foreground">Salvar no diário</Button></div></section></div>;
}
