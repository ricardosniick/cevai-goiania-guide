import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rateLimit, searchPlaceData, type PlaceSummary } from "./places.functions";
import { SYSTEM_PROMPT, WISH_MAX, buildUserMessage, parsePicks } from "./ai-recommend";

const MODEL = "anthropic/claude-haiku-4-5";
const AI_LIMIT_MSG = "Você fez muitos pedidos ao assistente. Tente de novo daqui a pouco.";

function aiError(status: number): Error {
  if (status === 429) return new Error("O assistente está ocupado agora. Tente de novo em instantes.");
  if (status === 402 || status === 403) return new Error("O assistente está indisponível no momento.");
  return new Error("Não foi possível falar com o assistente. Tente de novo.");
}

/** Streams Claude's answer server-side (Messages API via the gateway) and returns the final text. */
async function askClaude(user: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("O assistente está indisponível no momento.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch", "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM_PROMPT, messages: [{ role: "user", content: user }], stream: true }),
  });
  if (!res.ok || !res.body) { console.error("[recommendPlaces] gateway", res.status); throw aiError(res.status); }
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf = ""; let text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      let ev: { type?: string; delta?: { type?: string; text?: string; stop_reason?: string }; error?: { type?: string } };
      try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
      if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") text += ev.delta.text ?? "";
      else if (ev.type === "message_delta" && ev.delta?.stop_reason === "refusal") throw new Error("O assistente não pôde ajudar com esse pedido.");
      else if (ev.type === "error") { console.error("[recommendPlaces] stream", ev.error?.type); throw aiError(ev.error?.type === "permission_error" ? 403 : 500); }
    }
  }
  return text;
}

export type Recommendation = { place: PlaceSummary; reason: string };

export const recommendPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ wish: z.string().trim().min(3).max(WISH_MAX), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(d))
  .handler(async ({ data, context }): Promise<Recommendation[]> => {
    await rateLimit(context.userId, "ai_reco_minute", 5, 60, AI_LIMIT_MSG);
    await rateLimit(context.userId, "ai_reco_day", 30, 86400, AI_LIMIT_MSG);
    // Real places only: candidates come from the existing Google search (same per-user and global limits).
    const candidates = await searchPlaceData({ query: data.wish, lat: data.lat, lng: data.lng }, context.userId, "search", true);
    if (!candidates.length) return [];
    const text = await askClaude(buildUserMessage(data.wish, candidates));
    const picks = parsePicks(text, candidates.map((c) => c.id));
    const byId = new Map(candidates.map((c) => [c.id, c]));
    return picks.map((p) => ({ place: byId.get(p.id)!, reason: p.reason }));
  });
