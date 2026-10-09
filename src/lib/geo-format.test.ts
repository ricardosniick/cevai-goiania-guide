import { describe, expect, it } from "vitest";
import { distanceKm, formatKm } from "./geo-format";
const center = { lat: -16.68, lng: -49.25 };
describe("expired coordinate formatting", () => {
  it.each([{ lat: null, lng: null }, { lat: null, lng: -49.25 }, { lat: NaN, lng: NaN }, { lat: Infinity, lng: -49.25 }, { lat: 91, lng: 0 }, { lat: 0, lng: 0 }])("does not invent a distance for %j", point => {
    expect(formatKm(distanceKm(center, point))).toBe("");
    expect(formatKm(distanceKm(point, center))).toBe("");
  });
  it("preserves a legitimate zero distance and original units", () => {
    expect(formatKm(distanceKm(center, center))).toBe("0 m");
    expect(formatKm(0.143)).toBe("143 m");
    expect(formatKm(1.55)).toBe("1,6 km");
  });
  it.each([NaN, Infinity, -Infinity, -1])("hides invalid distance %s", km => expect(formatKm(km)).toBe(""));
});
