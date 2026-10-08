import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ upload: vi.fn(), insert: vi.fn(), check: vi.fn(), remove: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  storage: { from: () => ({ upload: m.upload, remove: m.remove }) },
  from: () => ({ insert: m.insert, select: () => ({ eq: () => ({ maybeSingle: m.check }) }) }),
} }));
import { saveExperiencePhoto } from "./experience-photo";
const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
beforeEach(() => {
  vi.clearAllMocks();
  m.upload.mockResolvedValue({ error: null });
  m.insert.mockResolvedValue({ error: null });
  m.check.mockResolvedValue({ data: null, error: null });
  m.remove.mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
describe("experience photo reconciliation", () => {
  it("links the uploaded file and keeps it", async () => {
    expect(await saveExperiencePhoto("user", "experience", file)).toBe(true);
    const path = m.upload.mock.calls[0]?.[0];
    expect(m.insert).toHaveBeenCalledWith({ user_id: "user", experience_id: "experience", storage_path: path });
    expect(m.remove).not.toHaveBeenCalled();
  });
  it.each(["error", "throw"])("cleans an unlinked upload after insert %s", async (kind) => {
    if (kind === "error") m.insert.mockResolvedValue({ error: new Error("failed") });
    else m.insert.mockRejectedValue(new Error("connection lost"));
    expect(await saveExperiencePhoto("user", "experience", file)).toBe(false);
    expect(m.remove).toHaveBeenCalledWith([m.upload.mock.calls[0]?.[0]]);
  });
  it("preserves a committed link when its response was lost", async () => {
    m.insert.mockRejectedValue(new Error("lost response"));
    m.check.mockResolvedValue({ data: { user_id: "user", experience_id: "experience" }, error: null });
    expect(await saveExperiencePhoto("user", "experience", file)).toBe(true);
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("preserves the file when the link cannot be verified", async () => {
    m.insert.mockResolvedValue({ error: new Error("failed") });
    m.check.mockResolvedValue({ data: null, error: new Error("offline") });
    expect(await saveExperiencePhoto("user", "experience", file)).toBe(false);
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("does not link or remove after a rejected upload", async () => {
    m.upload.mockResolvedValue({ error: new Error("denied") });
    expect(await saveExperiencePhoto("user", "experience", file)).toBe(false);
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("reports cleanup failure without losing the saved experience", async () => {
    m.insert.mockResolvedValue({ error: new Error("failed") });
    m.remove.mockRejectedValue(new Error("offline"));
    expect(await saveExperiencePhoto("user", "experience", file)).toBe(false);
  });
});
