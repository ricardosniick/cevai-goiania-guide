import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

describe("social features in this version", () => {
  it("startPresence is switched off", async () => {
    const { PRESENCE_DISABLED } = await import("./places.functions");
    expect(PRESENCE_DISABLED).toBe(true);
  });
});
