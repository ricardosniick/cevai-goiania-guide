// Shared category taxonomy (client + server). Google types must be valid Places API (New) Table A types.
export type Sub = { key: string; label: string; emoji: string; types?: string[]; text?: string };
export type Group = { key: string; label: string; chip: string; emoji: string; color: string; subs: Sub[]; text?: string };

export const GROUPS: Group[] = [
  { key: "comer", label: "Alimentação", chip: "Comer", emoji: "🍴", color: "#E86024", subs: [
    { key: "restaurantes", label: "Restaurantes", emoji: "🍽️", types: ["restaurant"] },
    { key: "cafes", label: "Cafés", emoji: "☕", types: ["cafe", "coffee_shop"] },
    { key: "padarias", label: "Padarias", emoji: "🥖", types: ["bakery"] },
    { key: "bares", label: "Bares", emoji: "🍺", types: ["bar"] },
    { key: "bebidas", label: "Lojas de bebidas", emoji: "🍷", types: ["liquor_store"] },
    { key: "docerias", label: "Docerias", emoji: "🍰", types: ["confectionery", "dessert_shop"] },
    { key: "lanchonetes", label: "Lanchonetes", emoji: "🍔", types: ["fast_food_restaurant", "sandwich_shop"] },
  ] },
  { key: "cafes-g", label: "Cafés", chip: "Cafés", emoji: "☕", color: "#9A5B2E", subs: [] },
  { key: "feiras", label: "Feiras e experiências", chip: "Feiras", emoji: "🧺", color: "#C98A0B", text: "feira", subs: [
    { key: "feiras-todas", label: "Feiras", emoji: "🧺", text: "feira" },
    { key: "feiras-gastro", label: "Feiras gastronômicas", emoji: "🍢", text: "feira gastronômica" },
    { key: "feiras-artesanato", label: "Feiras de artesanato", emoji: "🎨", text: "feira de artesanato" },
    { key: "feiras-livres", label: "Feiras livres", emoji: "🥬", text: "feira livre" },
    { key: "eventos-rua", label: "Eventos de rua", emoji: "🎪", text: "evento de rua" },
  ] },
  { key: "auto", label: "Automotivo", chip: "Auto", emoji: "🚗", color: "#4B5563", subs: [
    { key: "mecanicas", label: "Mecânicas", emoji: "🔧", types: ["car_repair"] },
    { key: "postos", label: "Postos de combustível", emoji: "⛽", types: ["gas_station"] },
    { key: "autopecas", label: "Autopeças", emoji: "⚙️", types: ["auto_parts_store"] },
    { key: "borracharias", label: "Borracharias", emoji: "🛞", text: "borracharia" },
    { key: "estetica", label: "Estética automotiva", emoji: "✨", text: "estética automotiva" },
    { key: "lava", label: "Lava-rápidos", emoji: "🫧", types: ["car_wash"] },
  ] },
  { key: "saude", label: "Saúde", chip: "Saúde", emoji: "🏥", color: "#D23C4B", subs: [
    { key: "clinicas", label: "Clínicas", emoji: "🩺", text: "clínica médica" },
    { key: "hospitais", label: "Hospitais", emoji: "🏥", types: ["hospital"] },
    { key: "laboratorios", label: "Laboratórios", emoji: "🧪", types: ["medical_lab"] },
    { key: "dentistas", label: "Dentistas", emoji: "🦷", types: ["dentist", "dental_clinic"] },
    { key: "farmacias", label: "Farmácias", emoji: "💊", types: ["pharmacy"] },
  ] },
  { key: "compras", label: "Compras", chip: "Compras", emoji: "🛍️", color: "#B0377A", subs: [
    { key: "lojas", label: "Lojas", emoji: "🛍️", types: ["clothing_store", "store"] },
    { key: "shoppings", label: "Shoppings", emoji: "🏬", types: ["shopping_mall"] },
    { key: "supermercados", label: "Supermercados", emoji: "🛒", types: ["supermarket", "grocery_store"] },
    { key: "livrarias", label: "Livrarias", emoji: "📚", types: ["book_store"] },
    { key: "sebos", label: "Sebos", emoji: "📖", text: "sebo livros usados" },
  ] },
  { key: "lazer", label: "Lazer e cultura", chip: "Lazer", emoji: "🎭", color: "#2F8F5B", subs: [
    { key: "parques", label: "Parques", emoji: "🌳", types: ["park"] },
    { key: "cinemas", label: "Cinemas", emoji: "🎬", types: ["movie_theater"] },
    { key: "teatros", label: "Teatros", emoji: "🎭", types: ["performing_arts_theater"] },
    { key: "museus", label: "Museus", emoji: "🏛️", types: ["museum"] },
    { key: "centros", label: "Centros culturais", emoji: "🎨", types: ["cultural_center"] },
    { key: "eventos", label: "Eventos", emoji: "🎟️", types: ["event_venue"] },
  ] },
  { key: "hospedagem", label: "Hospedagem", chip: "Hospedagem", emoji: "🏨", color: "#2F6FB0", subs: [
    { key: "hoteis", label: "Hotéis", emoji: "🏨", types: ["hotel", "lodging"] },
    { key: "pousadas", label: "Pousadas", emoji: "🏡", types: ["bed_and_breakfast", "guest_house"] },
  ] },
  { key: "conhecimento", label: "Conhecimento", chip: "Conhecimento", emoji: "📚", color: "#7A4FC2", subs: [
    { key: "livrarias-c", label: "Livrarias", emoji: "📚", types: ["book_store"] },
    { key: "sebos-c", label: "Sebos", emoji: "📖", text: "sebo livros usados" },
    { key: "bibliotecas", label: "Bibliotecas", emoji: "🏛️", types: ["library"] },
    { key: "cursos", label: "Cursos", emoji: "🎓", text: "curso escola de cursos" },
  ] },
];
// "Cafés" chip reuses the Alimentação sub
GROUPS[1]!.subs = [GROUPS[0]!.subs[1]!];

export const HOME_CHIPS = ["comer", "cafes-g", "feiras", "auto", "saude", "compras"];
export const MAP_CHIPS = ["comer", "cafes-g", "feiras", "auto", "saude", "compras", "lazer", "hospedagem", "conhecimento"];

export function findFilter(key: string): { group: Group; sub: Sub | null } | null {
  for (const g of GROUPS) {
    if (g.key === key) return { group: g, sub: null };
    const s = g.subs.find((x) => x.key === key);
    if (s) return { group: g, sub: s };
  }
  return null;
}
export const filterLabel = (key: string) => { const f = findFilter(key); return f ? (f.sub ? f.sub.label : f.group.chip) : ""; };
export const filterEmoji = (key: string) => { const f = findFilter(key); return f ? (f.sub ? f.sub.emoji : f.group.emoji) : "📍"; };

/** Resolve a filter into a Google request: either includedTypes (nearby) or a text query. */
export function resolveFilter(key: string | undefined): { types?: string[]; text?: string; label?: string } {
  if (!key) return {};
  const f = findFilter(key);
  if (!f) return {};
  if (f.sub) return f.sub.text ? { text: f.sub.text, label: f.sub.label } : { types: f.sub.types ?? [], label: f.sub.label };
  if (f.group.text) return { text: f.group.text, label: f.group.subs[0]?.label ?? f.group.chip };
  return { types: Array.from(new Set(f.group.subs.flatMap((s) => s.types ?? []))) };
}

const ALL_SUBS = GROUPS.flatMap((g) => g.subs.map((s) => ({ s, g })));
/** Label a Google place by its types. */
export function categoryFromTypes(types: string[], name = ""): string {
  if (/\bfeira\b/i.test(name)) return "Feiras";
  for (const { s } of ALL_SUBS) if (s.types?.some((t) => types.includes(t))) return s.label;
  if (types.some((t) => t.includes("restaurant"))) return "Restaurantes";
  if (types.some((t) => t.includes("clinic") || t === "doctor")) return "Clínicas";
  if (types.includes("tourist_attraction")) return "Parques";
  return "Outros";
}

const LEGACY: Record<string, string> = { Saúde: "saude", Cultura: "lazer", Lojas: "compras" };
export function groupOfLabel(label: string): Group | null {
  if (LEGACY[label]) return GROUPS.find((g) => g.key === LEGACY[label]) ?? null;
  return ALL_SUBS.find(({ s }) => s.label === label)?.g ?? null;
}
export const emojiOfLabel = (label: string) => ALL_SUBS.find(({ s }) => s.label === label)?.s.emoji ?? groupOfLabel(label)?.emoji ?? "📍";
export const colorOfLabel = (label: string) => groupOfLabel(label)?.color ?? "#123A32";
export const isFair = (label: string, name = "") => label.startsWith("Feira") || label === "Eventos de rua" || /\bfeira\b/i.test(name);

const C = (a: string, b: string, c: string, d: string) => [a, b, c, d];
const CRITERIA: Record<string, string[]> = {
  Restaurantes: C("Comida", "Atendimento", "Ambiente", "Custo-benefício"),
  Lanchonetes: C("Comida", "Atendimento", "Ambiente", "Custo-benefício"),
  Bares: C("Bebidas", "Atendimento", "Ambiente", "Custo-benefício"),
  Padarias: C("Qualidade", "Atendimento", "Variedade", "Custo-benefício"),
  Docerias: C("Qualidade", "Atendimento", "Variedade", "Custo-benefício"),
  Cafés: C("Qualidade", "Ambiente", "Atendimento", "Custo-benefício"),
  Hotéis: C("Conforto", "Limpeza", "Localização", "Atendimento"),
  Pousadas: C("Conforto", "Limpeza", "Localização", "Atendimento"),
  Parques: C("Estrutura", "Ambiente", "Limpeza", "Segurança"),
  Mecânicas: C("Atendimento", "Qualidade do serviço", "Preço", "Prazo"),
  Borracharias: C("Atendimento", "Qualidade do serviço", "Preço", "Prazo"),
  "Estética automotiva": C("Atendimento", "Qualidade do serviço", "Preço", "Prazo"),
  "Lava-rápidos": C("Atendimento", "Qualidade do serviço", "Preço", "Prazo"),
  "Postos de combustível": C("Atendimento", "Preço", "Estrutura", "Localização"),
  Clínicas: C("Atendimento", "Organização", "Pontualidade", "Estrutura"),
  Laboratórios: C("Atendimento", "Organização", "Pontualidade", "Estrutura"),
  Dentistas: C("Atendimento", "Organização", "Pontualidade", "Estrutura"),
  Hospitais: C("Atendimento", "Organização", "Estrutura", "Tempo de espera"),
  Lojas: C("Atendimento", "Variedade", "Preço", "Qualidade"),
  Shoppings: C("Variedade", "Estrutura", "Limpeza", "Estacionamento"),
  Supermercados: C("Atendimento", "Variedade", "Preço", "Qualidade"),
  Feiras: C("Variedade", "Ambiente", "Organização", "Preço"),
};
export const STALL_CRITERIA = C("Comida", "Atendimento", "Preço", "Qualidade");
export function criteriaFor(label: string): string[] {
  if (CRITERIA[label]) return CRITERIA[label];
  if (label.startsWith("Feira") || label === "Eventos de rua") return CRITERIA["Feiras"]!;
  return C("Atendimento", "Ambiente", "Custo-benefício", "Experiência");
}

export const STALL_KINDS = [
  { kind: "Comida", emoji: "🍢" }, { kind: "Doces", emoji: "🍰" }, { kind: "Bebidas", emoji: "🥤" },
  { kind: "Roupas", emoji: "👕" }, { kind: "Artesanato", emoji: "🎨" }, { kind: "Antiguidades", emoji: "🏺" },
  { kind: "Hortifrúti", emoji: "🥬" }, { kind: "Outros", emoji: "🛖" },
];

/** "Estou aqui" só existe em locais de convivência social; qualquer outra categoria não exibe o recurso. */
export const PRESENCE_CATEGORIES = new Set(["Bares", "Restaurantes", "Eventos", "Parques"]);
export const allowsPresence = (category: string | null | undefined) => !!category && PRESENCE_CATEGORIES.has(category);
