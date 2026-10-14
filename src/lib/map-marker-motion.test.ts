import { afterEach, describe, expect, it, vi } from "vitest";
import { animateSelectedMarker } from "./map-marker-motion";

afterEach(() => vi.unstubAllGlobals());

function setup(reduced = false) {
  let pending: FrameRequestCallback | undefined;
  const cancel = vi.fn();
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  const request = vi.fn((callback: FrameRequestCallback) => { pending = callback; return 1; });
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  return { request, cancel, step: (time: number) => { const callback = pending; pending = undefined; callback?.(time); } };
}

describe("selected map marker motion", () => {
  it("hops once and returns to its selected size after 400ms", () => {
    const clock = setup(); const update = vi.fn();
    animateSelectedMarker(update);
    clock.step(100); clock.step(300);
    expect(update).toHaveBeenLastCalledWith(16, 8);
    clock.step(500);
    const [scale, lift] = update.mock.lastCall!;
    expect(scale).toBeCloseTo(13); expect(lift).toBeCloseTo(0);
    expect(clock.request).toHaveBeenCalledTimes(3);
  });
  it("does not schedule animation when reduced motion is preferred", () => {
    const clock = setup(true); const update = vi.fn();
    animateSelectedMarker(update)();
    expect(clock.request).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  });
  it("stops pending updates when selection changes or the map unmounts", () => {
    const clock = setup(); const update = vi.fn();
    const stop = animateSelectedMarker(update);
    clock.step(100); stop(); clock.step(200);
    expect(clock.cancel).toHaveBeenCalledWith(1);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
