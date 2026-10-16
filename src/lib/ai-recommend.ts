// Pure helpers for the "Cê vai onde?" assistant: prompt building and safe parsing of Claude's picks.
export const MAX_PICKS = 3;
export const WISH_MAX = 120;

export type Candidate = { id: string; name: string; category: string; typeLabel: string; address: string; rating: number | null; ratingCount: number | null };
export type Pick = { id: string; reason: string };

export const SYSTEM_PROMPT = `Você é o assistente do app "Cê Vai?", um guia de lazer de Goiânia.
Escolha no máximo ${MAX_PICKS} lugares da lista recebida que melhor combinam com o pedido da pessoa.
Use SOMENTE lugares da lista, pelo id exato. Nunca invente lugares, horários, preços ou detalhes que não estejam nos dados.
Para cada escolha, escreva um motivo curto (até 140 caracteres), em português do Brasil, tom amigável.
Se nada combinar, devolva lista vazia.
Responda apenas com JSON neste formato: {"picks":[{"id":"...","reason":"..."}]}`;

export function buildUserMessage(wish: string, candidates: Candidate[]): string {
  const list = candidates.map((c) => ({ id: c.id, nome: c.name, categoria: c.category, tipo: c.typeLabel, endereco: c.address, nota_google: c.rating, avaliacoes: c.ratingCount }));
  return `Pedido: ${wish.slice(0, WISH_MAX)}\n\nLugares (dados do Google):\n${JSON.stringify(list)}`;
}

/** Keeps only ids present in the real candidate list, deduplicated, at most MAX_PICKS, reasons clamped. */
export function parsePicks(text: string, candidateIds: string[]): Pick[] {
  const start = text.indexOf("{"); const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(text.slice(start, end + 1)); } catch { return []; }
  const picks = (parsed as { picks?: unknown })?.picks;
  if (!Array.isArray(picks)) return [];
  const allowed = new Set(candidateIds); const seen = new Set<string>(); const out: Pick[] = [];
  for (const p of picks) {
    const id = (p as { id?: unknown })?.id; const reason = (p as { reason?: unknown })?.reason;
    if (typeof id !== "string" || !allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, reason: typeof reason === "string" ? reason.trim().slice(0, 160) : "" });
    if (out.length >= MAX_PICKS) break;
  }
  return out;
}
