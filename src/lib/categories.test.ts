import { describe, expect, it } from "vitest";
import { GROUPS, allowsPresence, presenceRadius, presenceInterests, situationKind, situationRadius, resolveFilter, SITUATION_OPTIONS } from "./categories";

const PRESENCE = ["Bares", "Restaurantes", "Eventos", "Shows", "Parques", "Quadras de tênis", "Beach tennis", "Quadras esportivas", "Clubes esportivos"];

describe("allowsPresence", () => {
  it.each(PRESENCE)("allows %s", (c) => expect(allowsPresence(c)).toBe(true));

  it("rejects empty and non-social categories", () => {
    expect(allowsPresence(null)).toBe(false);
    expect(allowsPresence(undefined)).toBe(false);
    expect(allowsPresence("")).toBe(false);
    for (const c of ["Cafés", "Padarias", "Lanchonetes", "Feiras"]) expect(allowsPresence(c)).toBe(false);
  });

  it("only allows presence for a few categories in every non-social group", () => {
    for (const g of GROUPS) for (const s of g.subs) expect(allowsPresence(s.label)).toBe(PRESENCE.includes(s.label));
  });
});

describe("presenceRadius", () => {
  it("uses the per-kind radius", () => {
    expect(presenceRadius("Parques")).toBe(600);
    expect(presenceRadius("Eventos")).toBe(300);
    expect(presenceRadius("Shows")).toBe(300);
    expect(presenceRadius("Quadras de tênis")).toBe(250);
    expect(presenceRadius("Quadras esportivas")).toBe(250);
    expect(presenceRadius("Beach tennis")).toBe(250);
    expect(presenceRadius("Clubes esportivos")).toBe(250);
    expect(presenceRadius("Bares")).toBe(120);
    expect(presenceRadius("Restaurantes")).toBe(120);
  });
});

describe("presenceInterests", () => {
  it("returns the interest set for each kind", () => {
    expect(presenceInterests("Bares")).toContain("⚽ Futebol");
    expect(presenceInterests("Parques")).toContain("🏃 Corrida");
    expect(presenceInterests("Eventos")).toContain("💃 Dançar");
    expect(presenceInterests("Shows")).toEqual(presenceInterests("Eventos"));
    expect(presenceInterests("Restaurantes")).toContain("🍷 Vinho");
    expect(presenceInterests("Quadras de tênis")).toContain("🤝 Procurando parceiro");
    expect(presenceInterests("Clubes esportivos")).toEqual(presenceInterests("Beach tennis"));
  });
});

describe("situationKind", () => {
  it("returns null without a category or for unsupported ones", () => {
    expect(situationKind(null)).toBeNull();
    expect(situationKind("")).toBeNull();
    expect(situationKind("Farmácias")).toBeNull();
  });

  it("maps food, park, event and sport categories", () => {
    for (const c of ["Restaurantes", "Cafés", "Padarias", "Bares", "Docerias", "Lanchonetes", "Feiras gastronômicas"]) expect(situationKind(c)).toBe("comida");
    expect(situationKind("Parques")).toBe("parque");
    for (const c of ["Cinemas", "Teatros", "Eventos", "Shows", "Eventos de rua"]) expect(situationKind(c)).toBe("evento");
    expect(situationKind("Quadras de tênis")).toBe("tenis");
    expect(situationKind("Beach tennis")).toBe("tenis");
    expect(situationKind("Quadras esportivas")).toBe("esporte");
    expect(situationKind("Clubes esportivos")).toBe("esporte");
  });

  it("uses the name/type hint", () => {
    expect(situationKind("Lanchonetes", "Sorveteria Gelato")).toBe("sorveteria");
    expect(situationKind("Restaurantes", "Açaí da Praça")).toBe("sorveteria");
    expect(situationKind("Quadras esportivas", "Clube de Tênis")).toBe("tenis");
  });

  it("every kind has options", () => {
    for (const k of Object.keys(SITUATION_OPTIONS) as (keyof typeof SITUATION_OPTIONS)[]) expect(SITUATION_OPTIONS[k].length).toBeGreaterThan(0);
  });
});

describe("situationRadius", () => {
  it("reuses the presence radius for presence categories and 150 m otherwise", () => {
    expect(situationRadius("Parques")).toBe(600);
    expect(situationRadius("Bares")).toBe(120);
    expect(situationRadius("Cafés")).toBe(150);
    expect(situationRadius("Cinemas")).toBe(150);
  });
});

describe("resolveFilter", () => {
  it("returns nothing for empty or unknown keys", () => {
    expect(resolveFilter(undefined)).toEqual({});
    expect(resolveFilter("nao-existe")).toEqual({});
  });

  it("resolves subcategories to their types or text", () => {
    expect(resolveFilter("restaurantes")).toEqual({ types: ["restaurant"], label: "Restaurantes" });
    expect(resolveFilter("feiras-livres")).toEqual({ text: "feira livre", label: "Feiras livres" });
  });

  it("resolves text groups to the group's text query", () => {
    expect(resolveFilter("feiras")).toEqual({ text: "feira", label: "Feiras" });
  });

  it("resolves every group to a non-empty request", () => {
    for (const g of GROUPS) {
      const r = resolveFilter(g.key);
      if (g.text) expect(r.text).toBe(g.text);
      else if (g.subs.length) expect(new Set(r.types)).toEqual(new Set(g.subs.flatMap((s) => s.types ?? [])));
      else expect(r).toEqual({ types: [] });
    }
  });

  it("resolves every subcategory with a label", () => {
    for (const g of GROUPS) for (const s of g.subs) {
      const r = resolveFilter(s.key);
      expect(r.label).toBe(s.label);
      expect(r.text ?? r.types).toBeTruthy();
    }
  });
});
