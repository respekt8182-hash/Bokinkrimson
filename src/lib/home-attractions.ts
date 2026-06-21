import { isAttractionInCategory } from "@/lib/attraction-categories";
import type { StaticAttraction } from "@/lib/static-attractions";

type HomeAttractionCandidate = Pick<
  StaticAttraction,
  "category" | "gallery" | "isPublishedVisible" | "searchKeywords" | "tags" | "title"
>;

export function isHomeAttractionCandidate(item: HomeAttractionCandidate): boolean {
  const hasBeachMarker = [
    item.title,
    item.category ?? "",
    ...item.tags,
    ...item.searchKeywords,
  ].some((value) => /пляж/iu.test(value));

  return (
    item.isPublishedVisible &&
    !isAttractionInCategory(item.category, "beach") &&
    !hasBeachMarker &&
    item.gallery.some((image) => image.url && !image.url.includes("zaglushka"))
  );
}
