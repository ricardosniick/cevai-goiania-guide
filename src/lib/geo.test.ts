import { describe, expect, it } from "vitest";
import { distanceMeters, effectiveRadius, isInsideArea, PARK_MAX_RADIUS_M } from "./geo";

// Reference points in Goiânia
const PRACA_CIVICA = { latitude: -16.6799, longitude: -49.2556 };
const VACA_BRAVA = { latitude: -16.7069, longitude: -49.2711 };
const METERS_PER_DEG_LAT = (Math.PI * 6371000) / 180; // ≈ 111 194.93 m

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters(PRACA_CIVICA.latitude, PRACA_CIVICA.longitude, PRACA_CIVICA.latitude, PRACA_CIVICA.longitude)).toBe(0);
  });

  it("matches the meridian arc for a pure latitude change", () => {
    expect(distanceMeters(-16.68, -49.26, -16.69, -49.26)).toBeCloseTo(0.01 * METERS_PER_DEG_LAT, 3);
  });

  it("measures Praça Cívica → Parque Vaca Brava at about 3.4 km and is symmetric", () => {
    const d = distanceMeters(PRACA_CIVICA.latitude, PRACA_CIVICA.longitude, VACA_BRAVA.latitude, VACA_BRAVA.longitude);
    expect(d).toBeGreaterThan(3300);
    expect(d).toBeLessThan(3500);
    expect(distanceMeters(VACA_BRAVA.latitude, VACA_BRAVA.longitude, PRACA_CIVICA.latitude, PRACA_CIVICA.longitude)).toBeCloseTo(d, 6);
  });

  it("shrinks east-west distance with latitude (cos factor)", () => {
    const atGoiania = distanceMeters(-16.68, -49.26, -16.68, -49.25);
    const atEquator = distanceMeters(0, -49.26, 0, -49.25);
    expect(atGoiania).toBeLessThan(atEquator);
    expect(atGoiania / atEquator).toBeCloseTo(Math.cos((16.68 * Math.PI) / 180), 3);
  });
});

/** Point `meters` north of the reference. */
const north = (meters: number) => ({ lat: PRACA_CIVICA.latitude + meters / METERS_PER_DEG_LAT, lng: PRACA_CIVICA.longitude });

describe("isInsideArea", () => {
  it("accepts a point inside the radius", () => {
    expect(isInsideArea({ ...north(100), accuracy: 0 }, PRACA_CIVICA, 120)).toBe(true);
  });

  it("rejects a point outside the radius", () => {
    expect(isInsideArea({ ...north(200), accuracy: 0 }, PRACA_CIVICA, 120)).toBe(false);
  });

  it("adds the GPS accuracy as tolerance", () => {
    expect(isInsideArea({ ...north(150), accuracy: 0 }, PRACA_CIVICA, 120)).toBe(false);
    expect(isInsideArea({ ...north(150), accuracy: 40 }, PRACA_CIVICA, 120)).toBe(true);
  });

  it("caps the accuracy tolerance at 50 m", () => {
    expect(isInsideArea({ ...north(169), accuracy: 140 }, PRACA_CIVICA, 120)).toBe(true);
    expect(isInsideArea({ ...north(172), accuracy: 140 }, PRACA_CIVICA, 120)).toBe(false);
  });
});

describe("effectiveRadius", () => {
  const viewportOfDiagonal = (meters: number) => ({ low: PRACA_CIVICA, high: { latitude: PRACA_CIVICA.latitude + meters / METERS_PER_DEG_LAT, longitude: PRACA_CIVICA.longitude } });

  it("keeps the base radius without a viewport or for non-park categories", () => {
    expect(effectiveRadius(600, "Parques")).toBe(600);
    expect(effectiveRadius(120, "Bares", viewportOfDiagonal(5000))).toBe(120);
  });

  it("widens parks to half the viewport diagonal", () => {
    expect(effectiveRadius(600, "Parques", viewportOfDiagonal(2000))).toBeCloseTo(1000, 3);
  });

  it("never shrinks a park below its base radius", () => {
    expect(effectiveRadius(600, "Parques", viewportOfDiagonal(400))).toBe(600);
  });

  it("caps large parks at 1500 m", () => {
    expect(effectiveRadius(600, "Parques", viewportOfDiagonal(10000))).toBe(PARK_MAX_RADIUS_M);
    expect(PARK_MAX_RADIUS_M).toBe(1500);
  });
});
