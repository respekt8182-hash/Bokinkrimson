export type SpecialAttractionMarkerCategory =
  | "bay"
  | "strait"
  | "gulf"
  | "crimean_bridge"
  | "dolphinarium";

function normalizeMarkerIdentity(value: string): string {
  return value
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSpecialAttractionMarkerCategory(input: {
  id?: string | null;
  path?: string | null;
  title?: string | null;
}): SpecialAttractionMarkerCategory | null {
  const identity = [input.id, input.path, input.title]
    .map((value) => normalizeMarkerIdentity(value ?? ""))
    .filter(Boolean)
    .join(" ");

  if (/крымск[а-я]* мост|krymsk[a-z]* most|crimean bridge/.test(identity)) {
    return "crimean_bridge";
  }
  if (/дельфинар|delfinar|dolphinarium/.test(identity)) {
    return "dolphinarium";
  }
  if (/пролив|proliv|strait/.test(identity)) {
    return "strait";
  }
  if (/залив|zaliv|gulf/.test(identity)) {
    return "gulf";
  }
  if (/бухт|buhta|bukhta|bay/.test(identity)) {
    return "bay";
  }

  return null;
}
