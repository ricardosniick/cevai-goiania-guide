import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: (bucket: string) => {
  expect(bucket).toBe("experience-photos"); return { download: m.download };
} } } }));
import { SharedExperiencePhoto } from "./SharedExperiencePhoto";
const create = vi.fn();
const revoke = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); create.mockReturnValue("blob:local-photo");
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: revoke }));
  m.download.mockResolvedValue({ data: new Blob(["photo"], { type: "image/jpeg" }), error: null });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("authenticated shared photos", () => {
  it("downloads using the session, disables HTTP cache, and preserves image classes", async () => {
    render(<SharedExperiencePhoto path="a/photo" viewerId="b" className="h-40 object-cover" />);
    const img = await screen.findByAltText("Foto da experiência");
    expect(img).toHaveAttribute("src", "blob:local-photo");
    expect(img).toHaveClass("h-40", "object-cover");
    expect(m.download).toHaveBeenCalledWith("a/photo", {}, { cache: "no-store", signal: expect.any(AbortSignal) });
  });
  it("never downloads without a viewer", () => {
    render(<SharedExperiencePhoto path="a/photo" className="h-40" />);
    expect(m.download).not.toHaveBeenCalled();
  });
  it.each(["denied", "thrown"])("%s download does not expose an image or fall back to a signed URL", async (kind) => {
    if (kind === "thrown") m.download.mockRejectedValue(new Error("offline"));
    else m.download.mockResolvedValue({ data: new Blob(["old"]), error: { message: "denied" } });
    render(<SharedExperiencePhoto path="a/photo" viewerId="b" className="h-40" />);
    await waitFor(() => expect(m.download).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("img")).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
  it("aborts and releases the local URL when leaving the screen", async () => {
    const view = render(<SharedExperiencePhoto path="a/photo" viewerId="b" className="h-40" />);
    await screen.findByRole("img");
    const signal = m.download.mock.calls[0]![2].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    expect(revoke).toHaveBeenCalledWith("blob:local-photo");
  });
  it("a new account cannot reuse the previous account's image", async () => {
    const view = render(<SharedExperiencePhoto path="a/photo" viewerId="b" className="h-40" />);
    await screen.findByRole("img");
    m.download.mockResolvedValue({ data: null, error: { message: "denied" } });
    view.rerender(<SharedExperiencePhoto path="a/photo" viewerId="c" className="h-40" />);
    await waitFor(() => expect(m.download).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("img")).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:local-photo");
  });
  it("ignores a late response after cancellation", async () => {
    let finish!: (v: unknown) => void;
    m.download.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const view = render(<SharedExperiencePhoto path="a/photo" viewerId="b" className="h-40" />);
    view.unmount();
    finish({ data: new Blob(["late"]), error: null });
    await Promise.resolve();
    expect(create).not.toHaveBeenCalled();
  });
});
