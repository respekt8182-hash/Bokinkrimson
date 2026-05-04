import { describe, expect, it } from "vitest";
import {
  collectExcursionPresentationPhotoUrls,
  collectExcursionProgramPhotoUrls,
} from "../../src/lib/excursions";
import {
  buildExcursionPhotoStorageWithSectionFallback,
  getItineraryDayPhotoUrls,
  getTimelineStepPhotoUrls,
  resolveExcursionSectionPhotoState,
} from "../../src/types/excursions";

describe("excursion program photo helpers", () => {
  it("normalizes and deduplicates photo urls inside itinerary days", () => {
    expect(
      getItineraryDayPhotoUrls({
        photoUrls: [" /uploads/a.webp ", "/uploads/a.webp", "", " /uploads/b.webp "],
      }),
    ).toEqual(["/uploads/a.webp", "/uploads/b.webp"]);
  });

  it("normalizes and deduplicates photo urls inside timeline steps", () => {
    expect(
      getTimelineStepPhotoUrls({
        photoUrls: [" /uploads/c.webp ", "/uploads/c.webp", " /uploads/d.webp "],
      }),
    ).toEqual(["/uploads/c.webp", "/uploads/d.webp"]);
  });

  it("collects unique nested program photo urls across days and steps", () => {
    expect(
      collectExcursionProgramPhotoUrls({
        itineraryDays: [
          {
            day: 1,
            title: "Day 1",
            description: "desc",
            locations: [],
            photoUrls: ["/uploads/a.webp"],
          },
          {
            day: 2,
            title: "Day 2",
            description: "desc",
            locations: [],
            photoUrls: ["/uploads/b.webp"],
          },
        ],
        timeline: [
          {
            step: 1,
            time: "10:00",
            duration: "1h",
            title: "Stop",
            photoUrls: ["/uploads/b.webp", "/uploads/c.webp"],
          },
        ],
      }),
    ).toEqual(["/uploads/a.webp", "/uploads/b.webp", "/uploads/c.webp"]);
  });

  it("collects all visible card photos from gallery, sections, days and steps", () => {
    expect(
      collectExcursionPresentationPhotoUrls({
        photoUrls: [" /uploads/gallery.webp ", "/uploads/duplicate.webp"],
        sectionPhotoGroups: {
          dates: ["/uploads/dates.webp"],
          program: ["/uploads/duplicate.webp"],
        },
        itineraryDays: [
          {
            day: 1,
            title: "Day 1",
            description: "desc",
            locations: [],
            photoUrls: ["/uploads/day.webp"],
          },
        ],
        timeline: [
          {
            step: 1,
            time: "10:00",
            duration: "1h",
            title: "Stop",
            photoUrls: ["/uploads/step.webp"],
          },
        ],
      }),
    ).toEqual([
      "/uploads/gallery.webp",
      "/uploads/duplicate.webp",
      "/uploads/dates.webp",
      "/uploads/day.webp",
      "/uploads/step.webp",
    ]);
  });

  it("restores section photos from compatibility fallback stored in photoUrls", () => {
    const storedPhotoUrls = buildExcursionPhotoStorageWithSectionFallback(["/uploads/gallery.webp"], {
      dates: ["/uploads/dates.webp"],
      program: ["/uploads/program.webp"],
    });

    expect(resolveExcursionSectionPhotoState({ photoUrls: storedPhotoUrls })).toEqual({
      photoUrls: ["/uploads/gallery.webp"],
      sectionPhotoGroups: {
        dates: ["/uploads/dates.webp"],
        program: ["/uploads/program.webp"],
        logistics: [],
        accommodation: [],
        included: [],
        requirements: [],
      },
    });

    expect(
      collectExcursionPresentationPhotoUrls({
        photoUrls: storedPhotoUrls,
      }),
    ).toEqual(["/uploads/gallery.webp", "/uploads/dates.webp", "/uploads/program.webp"]);
  });
});
