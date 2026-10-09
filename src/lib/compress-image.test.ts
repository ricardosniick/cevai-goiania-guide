import { describe, expect, it } from "vitest";
import { compressImage, fitWithin } from "./compress-image";
import { photoRejection } from "./experience-photo-selection";

describe("on-device photo resizing", () => {
  it("limits the longer side to 1600 px keeping proportion", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });
  it("never enlarges small photos", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("sends the original file when resizing fails", async () => {
    const f = new File(["not really an image"], "a.jpg", { type: "image/jpeg" });
    expect(await compressImage(f)).toBe(f);
  });
});

describe("photo rejection warnings", () => {
  it("flags non-images and files over 10 MB", () => {
    expect(photoRejection([new File(["x"], "n.txt", { type: "text/plain" })])).toBe("not_image");
    expect(photoRejection([new File([new Uint8Array(10 * 1024 * 1024 + 1)], "h.jpg", { type: "image/jpeg" })])).toBe("too_large");
    expect(photoRejection([new File(["x"], "ok.jpg", { type: "image/jpeg" })])).toBeNull();
  });
});
