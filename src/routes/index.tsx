import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft, Bell, Bookmark, Building2, Camera, Check, ChevronRight,
  CircleUserRound, Coffee, Heart, Hotel, Map, MapPin, MoreHorizontal,
  Navigation, Park, Plus, Search, Send, Share2, ShoppingBag, Star, Store,
  Trees, Utensils, X,
} from "lucide-react";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import goianiaHero from "@/assets/goiania-hero.jpg";
import restaurantBaru from "@/assets/restaurant-baru.jpg";
import cafeBiscoito from "@/assets/cafe-biscoito.jpg";
import parqueFlamboyant from "@/assets/parque-flamboyant.jpg";

type Screen = "welcome" | "home" | "map" | "detail";
type Category = "Todos" | "Restaurantes" | "Cafés" | "Parques" | "Hotéis" | "Lojas";

const categories: Array<{ name: Category; icon: typeof Utensils; tone: string }> = [
  { name: "Restaurantes", icon: Utensils, tone: "bg-secondary text-secondary-foreground" },
  { name: "Cafés", icon: Coffee, tone: "bg-amber-100 text-amber-800" },
  { name: "Parques", icon: Trees, tone: "bg-emerald-100 text-emerald-700" },
  { name: "Hotéis", icon: Hotel, tone: "bg-sky-100 text-sky-700" },
  { name: "Lojas", icon: ShoppingBag, tone: "bg-violet-100 text-violet-700" },
];

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

function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`inline-flex items-center justify-center font-bold transition active:scale-[.98] disabled:opacity-50 ${className}`} {...props} />;
}

function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <div className={`font-display font-black tracking-normal ${compact ? "text-3xl" : "text-6xl"} ${light ? "text-primary-foreground" : "text-primary"}`}>
      Cê <span className="text-secondary">Vai<span className="inline-block rotate-6">?</span></span>
    </div>
  );
}

function StatusBar({ light = false }: { light?: boolean }) {
  return <div className={`absolute inset-x-0 top-0 z-30 flex h-11 items-center justify-between px-6 text-[11px] font-extrabold ${light ? "text-primary-foreground" : "text-foreground"}`}><span>9:41</span><span className="tracking-widest">● ◒ ▰</span></div>;
}

function CeVaiApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [modalOpen, setModalOpen] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>("Todos");
  const [toast, setToast] = useState("");

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };

  return (
    <main className="min-h-dvh bg-primary/5 p-0 sm:grid sm:place-items-center sm:p-7">
      <div className="relative h-dvh w-full overflow-hidden bg-background sm:h-[852px] sm:max-h-[calc(100vh-3.5rem)] sm:w-[393px] sm:rounded-[2.6rem] sm:border-[7px] sm:border-foreground sm:shadow-2xl">
        {screen === "welcome" && <WelcomeScreen onEnter={() => setScreen("home")} />}
        {screen === "home" && <HomeScreen favorite={favorite} onFavorite={() => setFavorite((v) => !v)} onMap={() => setScreen("map")} onDetail={() => setScreen("detail")} onAdd={() => setModalOpen(true)} />}
        {screen === "map" && <MapScreen active={activeCategory} onCategory={setActiveCategory} onHome={() => setScreen("home")} onAdd={() => setModalOpen(true)} onDetail={() => setScreen("detail")} />}
        {screen === "detail" && <DetailScreen saved={saved} onBack={() => setScreen("home")} onSave={() => { setSaved((v) => !v); notify(saved ? "Removido dos salvos" : "Lugar salvo!"); }} onGo={() => notify("Adicionado à sua lista")} />}
        {modalOpen && <ExperienceModal onClose={() => setModalOpen(false)} onPublish={() => { setModalOpen(false); notify("Experiência publicada!"); }} />}
        {toast && <div className="absolute bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background shadow-xl"><Check size={16} />{toast}</div>}
      </div>
    </main>
  );
}

function WelcomeScreen({ onEnter }: { onEnter: () => void }) {
  return (
    <section className="animate-screen-in relative h-full overflow-hidden bg-primary">
      <StatusBar light />
      <img src={goianiaHero} width={768} height={1376} className="h-full w-full object-cover" alt="Vista aérea de Goiânia ao pôr do sol" />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-primary/5 to-primary/85" />
      <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-7 text-center text-primary-foreground">
        <Logo light />
        <p className="mt-5 font-display text-xl font-extrabold leading-tight">Descubra.<br />Vive.<br />Registra.</p>
        <div className="mt-10 space-y-3">
          <Button onClick={onEnter} className="h-12 w-full rounded-full bg-primary text-primary-foreground shadow-lg">Criar conta</Button>
          <Button onClick={onEnter} className="h-12 w-full rounded-full border border-primary-foreground/40 bg-background/90 text-primary backdrop-blur">Entrar</Button>
        </div>
        <p className="mt-6 text-[10px] font-semibold opacity-80">Explorando o que Goiânia tem de melhor ♥</p>
      </div>
    </section>
  );
}

function HomeScreen({ favorite, onFavorite, onMap, onDetail, onAdd }: { favorite: boolean; onFavorite: () => void; onMap: () => void; onDetail: () => void; onAdd: () => void }) {
  return (
    <section className="animate-screen-in h-full overflow-y-auto pb-24 pt-12">
      <StatusBar />
      <header className="flex items-center justify-between px-5"><Logo compact /><Bell size={21} className="text-primary" fill="currentColor" /></header>
      <div className="mx-5 mt-4 flex h-11 items-center gap-3 rounded-full border border-border bg-card px-4 shadow-sm"><Search size={17} className="text-muted-foreground" /><input aria-label="Buscar lugares" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="O que você vai descobrir hoje?" /><MoreHorizontal size={17} /></div>
      <div className="mt-5 flex justify-between px-4">
        {categories.map(({ name, icon: Icon, tone }) => <Button key={name} onClick={() => undefined} className="flex-col gap-1.5 text-[10px] font-bold text-foreground"><span className={`grid size-12 place-items-center rounded-full ${tone}`}><Icon size={21} /></span>{name}</Button>)}
      </div>
      <div className="mt-7 flex items-center justify-between px-5"><h1 className="font-display text-xl font-black">Destaques da semana</h1><Button className="gap-1 text-xs text-primary">Ver todos <ChevronRight size={14} /></Button></div>
      <article className="mx-5 mt-3 overflow-hidden rounded-2xl bg-card shadow-md">
        <button aria-label="Abrir Restaurante Baru" onClick={onDetail} className="relative block h-44 w-full overflow-hidden"><img src={restaurantBaru} width={1200} height={704} loading="lazy" alt="Interior do Restaurante Baru" className="h-full w-full object-cover" /><span className="absolute left-3 top-3 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-secondary-foreground">Em alta</span></button>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-4"><button onClick={onDetail} className="min-w-0 text-left"><h2 className="truncate font-display text-base font-extrabold">Restaurante Baru</h2><p className="mt-1 flex items-center gap-1 text-xs"><Star size={13} className="fill-secondary text-secondary" /> <b>4.8</b> (321) <span className="text-muted-foreground">• Setor Marista</span></p></button><Button aria-label="Favoritar" onClick={onFavorite} className="size-10 rounded-full bg-muted text-secondary"><Heart size={20} fill={favorite ? "currentColor" : "none"} /></Button></div>
      </article>
      <div className="mx-5 mt-3 grid grid-cols-2 gap-3">
        <SmallCard image={cafeBiscoito} title="Café Biscoito" area="Setor Bueno" rating="4.7" />
        <SmallCard image={parqueFlamboyant} title="Parque Flamboyant" area="Jardim Goiás" rating="4.9" />
      </div>
      <BottomNav active="home" onHome={() => undefined} onMap={onMap} onAdd={onAdd} />
    </section>
  );
}

function SmallCard({ image, title, area, rating }: { image: string; title: string; area: string; rating: string }) {
  return <article className="overflow-hidden rounded-2xl bg-card shadow-sm"><img src={image} loading="lazy" width={816} height={816} alt={title} className="h-28 w-full object-cover" /><div className="p-3"><h3 className="truncate text-sm font-extrabold">{title}</h3><p className="mt-1 flex items-center gap-1 text-[11px]"><Star size={11} className="fill-secondary text-secondary" />{rating}</p><p className="mt-1 text-[10px] text-muted-foreground">{area}</p></div></article>;
}

function BottomNav({ active, onHome, onMap, onAdd }: { active: "home" | "map"; onHome: () => void; onMap: () => void; onAdd: () => void }) {
  const item = "flex flex-col items-center gap-1 text-[9px] font-bold";
  return <nav className="absolute inset-x-0 bottom-0 z-20 grid h-[78px] grid-cols-5 items-center border-t border-border bg-background/95 px-3 pb-2 backdrop-blur"><Button onClick={onHome} className={`${item} ${active === "home" ? "text-primary" : "text-muted-foreground"}`}><MapPin size={20} fill={active === "home" ? "currentColor" : "none"} />Explorar</Button><Button onClick={onMap} className={`${item} ${active === "map" ? "text-primary" : "text-muted-foreground"}`}><Map size={20} />Mapa</Button><Button aria-label="Registrar experiência" onClick={onAdd} className="mx-auto size-14 -translate-y-3 rounded-full bg-primary text-primary-foreground shadow-lg"><Plus size={28} /></Button><Button className={`${item} text-muted-foreground`}><Heart size={20} />Salvos</Button><Button className={`${item} text-muted-foreground`}><CircleUserRound size={20} />Perfil</Button></nav>;
}

function MapScreen({ active, onCategory, onHome, onMap: _onMap, onAdd, onDetail }: { active: Category; onCategory: (category: Category) => void; onHome: () => void; onMap?: () => void; onAdd: () => void; onDetail: () => void }) {
  const pins = [
    { x: "28%", y: "31%", label: "Setor Marista", tone: "bg-secondary", Icon: Utensils },
    { x: "59%", y: "42%", label: "Setor Bueno", tone: "bg-amber-700", Icon: Coffee },
    { x: "76%", y: "26%", label: "Flamboyant", tone: "bg-sky-600", Icon: Hotel },
    { x: "34%", y: "62%", label: "Jardim Goiás", tone: "bg-emerald-600", Icon: Trees },
    { x: "70%", y: "70%", label: "Parque Areião", tone: "bg-emerald-600", Icon: Trees },
  ];
  return <section className="animate-screen-in relative h-full overflow-hidden bg-muted pt-12"><StatusBar />
    <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(28deg, transparent 46%, var(--border) 47%, var(--border) 49%, transparent 50%), linear-gradient(112deg, transparent 45%, var(--card) 46%, var(--card) 52%, transparent 53%)", backgroundSize: "92px 78px, 120px 105px" }} />
    <div className="absolute left-[-20%] top-[47%] h-10 w-[150%] rotate-[-16deg] bg-sky-100/70" />
    <div className="relative z-10 mx-4 flex h-11 items-center gap-2 rounded-full bg-card px-4 shadow-lg"><Search size={17} /><input aria-label="Buscar nesta área" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Buscar nesta área" /><Navigation size={17} className="text-primary" /></div>
    <div className="relative z-10 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">{(["Todos", "Restaurantes", "Cafés", "Parques", "Hotéis"] as Category[]).map((cat) => <Button key={cat} onClick={() => onCategory(cat)} className={`h-8 shrink-0 rounded-full px-3 text-[11px] ${active === cat ? "bg-primary text-primary-foreground" : "bg-card text-foreground shadow-sm"}`}>{cat}</Button>)}</div>
    {pins.map(({ x, y, label, tone, Icon }) => <Button key={label} onClick={onDetail} style={{ left: x, top: y }} className="absolute z-10 -translate-x-1/2 flex-col text-[10px] text-foreground"><span className={`grid size-10 place-items-center rounded-full border-2 border-background text-primary-foreground shadow-lg ${tone}`}><Icon size={17} /></span><span className="mt-1 rounded bg-background/75 px-1.5 py-0.5 backdrop-blur">{label}</span></Button>)}
    <div className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full bg-card px-4 py-2 text-sm font-black shadow">Goiânia</div>
    <Button aria-label="Minha localização" className="absolute bottom-24 right-4 z-10 size-12 rounded-full bg-card text-primary shadow-lg"><Navigation size={20} /></Button>
    <BottomNav active="map" onHome={onHome} onMap={() => undefined} onAdd={onAdd} />
  </section>;
}

function DetailScreen({ saved, onBack, onSave, onGo }: { saved: boolean; onBack: () => void; onSave: () => void; onGo: () => void }) {
  const [tab, setTab] = useState("Sobre");
  return <section className="animate-screen-in h-full overflow-y-auto pb-24 bg-background"><StatusBar light />
    <div className="relative h-64"><img src={restaurantBaru} width={1200} height={704} alt="Restaurante Baru" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-b from-foreground/30 to-transparent" /><div className="absolute left-4 right-4 top-12 flex justify-between"><Button aria-label="Voltar" onClick={onBack} className="size-10 rounded-full bg-background/90 text-foreground"><ArrowLeft size={20} /></Button><div className="flex gap-2"><Button aria-label="Compartilhar" className="size-10 rounded-full bg-background/90 text-foreground"><Share2 size={18} /></Button><Button aria-label="Mais opções" className="size-10 rounded-full bg-background/90 text-foreground"><MoreHorizontal size={20} /></Button></div></div></div>
    <div className="px-5 pt-5"><div className="flex items-start justify-between gap-3"><div><h1 className="font-display text-2xl font-black">Restaurante Baru</h1><p className="mt-1 flex items-center gap-1 text-sm"><Star size={15} className="fill-secondary text-secondary" /><b>4.8</b> (321 avaliações)</p></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-primary">Ver no mapa</span></div><p className="mt-2 text-xs text-muted-foreground">$$ · Restaurante · Setor Marista</p></div>
    <div className="mt-5 flex border-b border-border px-4">{["Sobre", "Avaliações", "Fotos", "Dicas"].map((name) => <Button key={name} onClick={() => setTab(name)} className={`h-11 flex-1 border-b-2 text-xs ${tab === name ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{name}</Button>)}</div>
    <div className="animate-screen-in px-5 py-5" key={tab}>{tab === "Sobre" && <><div className="grid grid-cols-3 gap-2"><img src={cafeBiscoito} loading="lazy" alt="Prato do Baru" className="aspect-square w-full rounded-xl object-cover" /><img src={parqueFlamboyant} loading="lazy" alt="Área externa" className="aspect-square w-full rounded-xl object-cover" /><img src={restaurantBaru} loading="lazy" alt="Ambiente do restaurante" className="aspect-square w-full rounded-xl object-cover" /></div><p className="mt-4 text-sm leading-relaxed">Cozinha brasileira contemporânea, ingredientes do cerrado e um ambiente acolhedor no coração do Marista.</p><h2 className="mt-6 font-display text-base font-black">Avaliações recentes</h2><div className="mt-3 flex gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary/20 font-black text-secondary">M</div><div><p className="text-xs font-bold">Mariana S.</p><p className="mt-1 text-xs text-secondary">★★★★★ <span className="text-muted-foreground">há 3 dias</span></p><p className="mt-2 text-xs">Comida incrível e ambiente muito agradável!</p></div></div></>}{tab !== "Sobre" && <div className="py-14 text-center text-sm text-muted-foreground">Conteúdo de {tab.toLowerCase()} em breve.</div>}</div>
    <div className="absolute inset-x-0 bottom-0 z-20 grid h-[76px] grid-cols-[1fr_1.35fr] gap-3 border-t border-border bg-background px-4 py-3"><Button onClick={onSave} className="gap-2 rounded-full border border-primary text-primary"><Bookmark size={18} fill={saved ? "currentColor" : "none" />{saved ? "Salvo" : "Salvar"}</Button><Button onClick={onGo} className="gap-2 rounded-full bg-primary text-primary-foreground"><Send size={17} />Quero ir</Button></div>
  </section>;
}

function ExperienceModal({ onClose, onPublish }: { onClose: () => void; onPublish: () => void }) {
  const [category, setCategory] = useState<Category>("Restaurantes");
  const [recommend, setRecommend] = useState(true);
  const [review, setReview] = useState("");
  return <div className="absolute inset-0 z-40 flex items-end bg-foreground/35 sm:items-center"><section role="dialog" aria-modal="true" aria-label="Registrar experiência" className="animate-modal-in flex h-[94%] w-full flex-col overflow-hidden rounded-t-[2rem] bg-background sm:h-full sm:rounded-none"><header className="grid h-16 shrink-0 grid-cols-[40px_1fr_40px] items-center border-b border-border px-4"><Button aria-label="Fechar" onClick={onClose} className="size-10 rounded-full"><X size={22} /></Button><h1 className="text-center font-display text-base font-black">Registrar experiência</h1></header><div className="flex-1 overflow-y-auto px-5 py-4">
    <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">{categories.slice(0,4).map(({ name, icon: Icon, tone }) => <Button key={name} onClick={() => setCategory(name)} className={`flex-col gap-1 rounded-2xl px-3 py-2 text-[9px] ${category === name ? "ring-2 ring-secondary" : ""}`}><span className={`grid size-10 place-items-center rounded-full ${tone}`}><Icon size={18} /></span>{name === "Restaurantes" ? "Restaurante" : name}</Button>)}</div>
    <label className="mt-3 grid h-28 place-items-center rounded-2xl border border-dashed border-border bg-card text-center"><input type="file" accept="image/*" multiple className="sr-only" /><span><span className="mx-auto grid size-9 place-items-center rounded-full bg-background shadow"><Camera size={18} /></span><b className="mt-2 block text-xs">Adicionar fotos</b><small className="text-muted-foreground">Até 10 fotos</small></span></label>
    <div className="mt-4 space-y-3"><input aria-label="Nome do lugar" className="h-12 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Qual é o nome do lugar?" /><div className="relative"><input aria-label="Localização" className="h-12 w-full rounded-xl border border-input bg-card px-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Onde fica?" /><MapPin className="absolute right-4 top-4 text-muted-foreground" size={17} /></div><div className="relative"><textarea aria-label="Sua experiência" value={review} onChange={(event) => setReview(event.target.value.slice(0,500))} className="h-32 w-full resize-none rounded-xl border border-input bg-card p-4 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Conte sua experiência..." /><span className="absolute bottom-3 right-3 text-[10px] text-muted-foreground">{review.length}/500</span></div></div>
    <div className="mt-5 flex items-center justify-between border-b border-border pb-5"><b className="text-sm">Como foi?</b><div className="flex gap-1 text-muted-foreground">{[1,2,3,4,5].map((n) => <Star key={n} size={21} />)}</div></div><div className="flex items-center justify-between py-5"><div><b className="text-sm">Recomendo?</b><p className="text-[11px] text-muted-foreground">Voltaria a este lugar?</p></div><Button role="switch" aria-checked={recommend} aria-label="Recomendo" onClick={() => setRecommend((v) => !v)} className={`h-7 w-12 justify-start rounded-full p-1 ${recommend ? "bg-primary" : "bg-muted"}`}><span className={`size-5 rounded-full bg-background shadow transition-transform ${recommend ? "translate-x-5" : "translate-x-0"}`} /></Button></div>
  </div><div className="shrink-0 border-t border-border p-4"><Button onClick={onPublish} className="h-12 w-full rounded-full bg-primary text-primary-foreground">Publicar</Button></div></section></div>;
}
