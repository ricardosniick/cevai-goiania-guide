import { useState, type InputHTMLAttributes } from "react";
import { ArrowLeft, ChevronRight, Heart, Image as ImageIcon, Lock, Star, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACTIVE_GROUPS, activeSubs, filterLabel, filterEmoji } from "@/lib/categories";
import type { PlaceStat } from "@/components/cevai/types";

export function LoginPrompt({ onLogin, text = "Entre na sua conta para buscar lugares reais, ver fotos e registrar experiências." }: { onLogin: () => void; text?: string }) {
  return <div className="mx-5 mt-6 rounded-2xl bg-primary p-6 text-primary-foreground">
    <Lock size={22} className="text-secondary" />
    <p className="mt-3 font-display text-lg font-black">Falta pouco para descobrir</p>
    <p className="mt-1 text-sm text-primary-foreground/80">{text}</p>
    <Button onClick={onLogin} className="mt-5 h-11 rounded-full bg-secondary px-6 font-extrabold text-secondary-foreground hover:bg-secondary/90">Entrar ou criar conta</Button>
  </div>;
}

export function CategoryChips({ value, onChange, chips, withAll = false, onAll, className = "" }: { value: string | null; onChange: (c: string | null) => void; chips: string[]; withAll?: boolean; onAll?: () => void; className?: string }) {
  const extra = value && !chips.includes(value) ? [value] : [];
  return <div className={`flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain scroll-smooth whitespace-nowrap py-1 pl-5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [touch-action:pan-x_pan-y] [&::-webkit-scrollbar]:hidden ${className}`}>
    {withAll && <button onClick={() => onChange(null)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold shadow-sm ${value === null ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>Todos</button>}
    {[...extra, ...chips].map((k) => <button key={k} onClick={() => onChange(value === k ? null : k)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold shadow-sm transition ${value === k ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}><span>{filterEmoji(k)}</span>{filterLabel(k)}</button>)}
    {onAll && <button onClick={onAll} className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-primary/40 px-4 py-2 text-sm font-extrabold text-primary">Ver todas<ChevronRight size={14} /></button>}
    <span aria-hidden className="w-3 shrink-0" />
  </div>;
}

export function CategoriesScreen({ value, onBack, onPick }: { value: string | null; onBack: () => void; onPick: (k: string) => void }) {
  return <section className="h-full overflow-y-auto pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
    <div className="flex items-center gap-2 px-3"><Button variant="ghost" size="icon" aria-label="Voltar" onClick={onBack} className="rounded-full"><ArrowLeft /></Button><h1 className="font-display text-2xl font-black">Todas as categorias</h1></div>
    <div className="mt-2 space-y-6 px-5">
      {ACTIVE_GROUPS.filter((g) => g.key !== "cafes-g").map((g) => <div key={g.key}>
        <button onClick={() => onPick(g.key)} className="flex w-full items-center justify-between"><h2 className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: g.color }}>{g.emoji} {g.label}</h2><span className="text-[11px] font-bold text-muted-foreground">Ver tudo</span></button>
        <div className="mt-2 grid grid-cols-2 gap-2">{activeSubs(g).map((sub) => <button key={sub.key} onClick={() => onPick(sub.key)} className={`flex items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm font-bold shadow-sm ${value === sub.key ? "bg-primary text-primary-foreground" : "bg-card"}`}><span className="text-lg">{sub.emoji}</span><span className="min-w-0 truncate">{sub.label}</span></button>)}</div>
      </div>)}
      <p className="rounded-2xl bg-muted p-4 text-xs text-muted-foreground">📚 Livros ficam no seu Perfil — eles não são lugares do mapa.</p>
    </div>
  </section>;
}

export function PlacePhoto({ src, alt, className = "" }: { src: string | null; alt: string; className?: string }) {
  // Old stored Google URLs expire: on load failure fall back to the existing "sem foto" look.
  const [broken, setBroken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  if (src && broken === src) src = null;
  return src ? <img key={src} ref={(image) => { if (image?.complete && image.naturalWidth > 0) setLoaded(src); }} src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onLoad={() => setLoaded(src)} onError={() => setBroken(src)} className={`place-photo object-cover ${loaded === src ? "opacity-100" : "opacity-0"} ${className}`} /> : <div className={`grid place-items-center bg-muted text-muted-foreground ${className}`}><ImageIcon size={28} /></div>;
}

export function Skeleton({ className }: { className: string }) { return <div className={`skeleton-shimmer rounded-2xl bg-muted ${className}`} />; }

export function EmptyState({ icon: Icon, title, text, action, onAction }: { icon: LucideIcon; title: string; text: string; action: string; onAction: () => void }) {
  return <div className="flex flex-col items-center px-4 py-8 text-center">
    <div className="grid size-20 place-items-center rounded-full bg-muted text-primary"><Icon size={36} strokeWidth={1.6} aria-hidden="true" /></div>
    <p className="mt-5 font-display text-lg font-black">{title}</p>
    <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{text}</p>
    <Button onClick={onAction} className="mt-5 h-11 rounded-full px-5 font-extrabold">{action}<ChevronRight size={16} /></Button>
  </div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  return <div className="mx-5 mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error instanceof Error ? error.message : "Não foi possível carregar os lugares."}</div>;
}

export function ListError({ onRetry }: { onRetry: () => void }) {
  return <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar. <button onClick={onRetry} className="font-bold underline">Tentar de novo</button></div>;
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return <span className="flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} className={n <= value ? "fill-secondary text-secondary" : "text-muted-foreground/60"} />)}</span>;
}

export function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-foreground/80">{label}</span><input {...props} className="h-12 w-full rounded-xl border border-input bg-card px-4 text-[15px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>;
}

export const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");
export function CeVaiRating({ stat }: { stat?: PlaceStat | undefined }) {
  if (!stat?.count) return <span className="text-[11px] font-semibold italic text-muted-foreground">Ainda sem experiências no Cê vai</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-primary"><Heart size={11} className="fill-secondary text-secondary" />{fmt1(stat.avg)} · Cê vai · {stat.count} {stat.count === 1 ? "experiência" : "experiências"}</span>;
}
