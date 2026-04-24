import { MediaType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  accommodationVideoUploadSizeLimitBytes,
  getAccommodationVideoUploadSizeError,
  validateMediaFile,
} from "../../src/lib/media";
import {
  accommodationJpegPngUploadSizeLimitBytes,
  accommodationPhotoUploadSizeLimitBytes,
  getAccommodationPhotoUploadSizeError,
} from "../../src/lib/photo-upload";

describe("validateMediaFile", () => {
  it("rejects oversized jpeg images at 10 MB", () => {
    expect(
      validateMediaFile({
        mediaType: MediaType.IMAGE,
        size: accommodationJpegPngUploadSizeLimitBytes + 1,
        mimeType: "image/jpeg",
        fileName: "photo.jpg",
      }),
    ).toBe(getAccommodationPhotoUploadSizeError());
  });

  it("allows heic images above the jpeg/png limit while within 20 MB", () => {
    expect(
      validateMediaFile({
        mediaType: MediaType.IMAGE,
        size: accommodationJpegPngUploadSizeLimitBytes + 1,
        mimeType: "image/heic",
        fileName: "photo.heic",
      }),
    ).toBeNull();
  });

  it("rejects oversized heic images at 20 MB", () => {
    expect(
      validateMediaFile({
        mediaType: MediaType.IMAGE,
        size: accommodationPhotoUploadSizeLimitBytes + 1,
        mimeType: "image/heic",
        fileName: "photo.heic",
      }),
    ).toBe(getAccommodationPhotoUploadSizeError());
  });

  it("rejects oversized videos", () => {
    expect(
      validateMediaFile({
        mediaType: MediaType.VIDEO,
        size: accommodationVideoUploadSizeLimitBytes + 1,
        mimeType: "video/mp4",
        fileName: "tour.mp4",
      }),
    ).toBe(getAccommodationVideoUploadSizeError());
  });

  it("accepts videos within the size limit", () => {
    expect(
      validateMediaFile({
        mediaType: MediaType.VIDEO,
        size: accommodationVideoUploadSizeLimitBytes,
        mimeType: "video/mp4",
        fileName: "tour.mp4",
      }),
    ).toBeNull();
  });
});
