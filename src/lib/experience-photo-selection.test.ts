import { describe, expect, it } from "vitest";
import { selectExperiencePhotos } from "./experience-photo-selection";
const photos = Array.from({ length: 7 }, (_, i) => new File(["image"], `${i}.jpg`, { type: "image/jpeg" }));
describe("experience photo capacity", () => {
  it("counts kept photos when a batch is selected during editing", () => {
    expect(selectExperiencePhotos([], photos, 2)).toEqual(photos.slice(0, 3));
  });
  it("keeps already selected files first and admits only the remaining capacity", () => {
    expect(selectExperiencePhotos([photos[0]!], photos.slice(1), 3)).toEqual(photos.slice(0, 2));
  });
  it("continues allowing five photos for a new experience", () => {
    expect(selectExperiencePhotos([], photos, 0)).toEqual(photos.slice(0, 5));
  });
  it("filters invalid files before consuming remaining slots", () => {
    const text = new File(["text"], "note.txt", { type: "text/plain" });
    const huge = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "huge.jpg", { type: "image/jpeg" });
    expect(selectExperiencePhotos([], [text, huge, photos[0]!], 4)).toEqual([photos[0]]);
  });
  it("admits nothing when five photos are kept; removing one makes space", () => {
    expect(selectExperiencePhotos([], photos, 5)).toEqual([]);
    expect(selectExperiencePhotos([], photos, 4)).toEqual([photos[0]]);
  });
});
