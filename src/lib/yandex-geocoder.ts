// Domain/service module for yandex geocoder.
const YANDEX_GEOCODER_URL = "https://geocode-maps.yandex.ru/1.x/";

export type GeocodeLocalityType =
  | "city"
  | "urban_settlement"
  | "village"
  | "settlement"
  | "hamlet"
  | "unknown";

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  address: string;
  localityName: string | null;
  localityType: GeocodeLocalityType | null;
  localityDisplayName: string | null;
};

type YandexAddressComponent = {
  kind?: string;
  name?: string;
};

type YandexGeocoderJson = {
  response?: {
    GeoObjectCollection?: {
      featureMember?: Array<{
        GeoObject?: {
          Point?: { pos?: string };
          metaDataProperty?: {
            GeocoderMetaData?: {
              text?: string;
              Address?: {
                Components?: YandexAddressComponent[];
              };
            };
          };
        };
      }>;
    };
  };
};

type ParsedLocality = {
  name: string;
  type: GeocodeLocalityType;
};

const localityTypePatterns: Array<{ type: GeocodeLocalityType; regex: RegExp }> = [
  { type: "urban_settlement", regex: /^(?:пгт|пос[её]лок\s+городского\s+типа)\s+(.+)$/i },
  { type: "village", regex: /^(?:с\.?|село)\s+(.+)$/i },
  { type: "settlement", regex: /^(?:пос\.?|пос[её]лок)\s+(.+)$/i },
  { type: "hamlet", regex: /^(?:д\.?|деревня|х\.?|хутор)\s+(.+)$/i },
  { type: "city", regex: /^(?:г\.?|город)\s+(.+)$/i },
];

const nonLocalitySegmentRegex =
  /(россия|республика|край|область|район|округ|улица|ул\.|проспект|пр-кт|шоссе|переулок|пер\.|дом|д\.)/i;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseLocalityToken(rawValue: string): ParsedLocality | null {
  const token = compactWhitespace(rawValue);
  if (!token) {
    return null;
  }

  for (const pattern of localityTypePatterns) {
    const match = token.match(pattern.regex);
    if (!match) {
      continue;
    }

    const name = compactWhitespace(match[1] ?? "");
    if (!name) {
      return null;
    }

    return { name, type: pattern.type };
  }

  return { name: token, type: "unknown" };
}

function formatLocality(locality: ParsedLocality): string {
  switch (locality.type) {
    case "urban_settlement":
      return `пгт ${locality.name}`;
    case "village":
      return `с. ${locality.name}`;
    case "settlement":
      return `пос. ${locality.name}`;
    case "hamlet":
      return `д. ${locality.name}`;
    default:
      return locality.name;
  }
}

function extractLocalityFromComponents(
  components: YandexAddressComponent[] | undefined,
): ParsedLocality | null {
  if (!components?.length) {
    return null;
  }

  const localityComponent = components.find((component) => component.kind === "locality");
  if (!localityComponent?.name) {
    return null;
  }

  return parseLocalityToken(localityComponent.name);
}

function extractLocalityFromAddressText(addressText: string): ParsedLocality | null {
  const parts = addressText
    .split(",")
    .map((part) => compactWhitespace(part))
    .filter((part) => part.length > 0);

  for (const part of parts) {
    const parsed = parseLocalityToken(part);
    if (parsed && parsed.type !== "unknown") {
      return parsed;
    }
  }

  for (const part of parts) {
    if (nonLocalitySegmentRegex.test(part)) {
      continue;
    }

    if (part.length < 2 || part.length > 80) {
      continue;
    }

    const parsed = parseLocalityToken(part);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function getApiKey(): string | null {
  return process.env.YANDEX_GEOCODER_API_KEY ?? process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? null;
}

function parseResult(json: YandexGeocoderJson): GeocodeResult | null {
  const first = json.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  const pos = first?.Point?.pos;
  const text = first?.metaDataProperty?.GeocoderMetaData?.text;
  const components = first?.metaDataProperty?.GeocoderMetaData?.Address?.Components;

  if (!pos || !text) {
    return null;
  }

  const [lngRaw, latRaw] = pos.split(" ");
  const latitude = Number(latRaw);
  const longitude = Number(lngRaw);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const locality =
    extractLocalityFromComponents(components) ?? extractLocalityFromAddressText(text);

  return {
    latitude,
    longitude,
    address: text,
    localityName: locality?.name ?? null,
    localityType: locality?.type ?? null,
    localityDisplayName: locality ? formatLocality(locality) : null,
  };
}

async function runGeocoder(geocodeValue: string): Promise<GeocodeResult | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  const params = new URLSearchParams({
    apikey: apiKey,
    format: "json",
    geocode: geocodeValue,
    lang: "ru_RU",
    results: "1",
  });

  const response = await fetch(`${YANDEX_GEOCODER_URL}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const json = (await response.json()) as YandexGeocoderJson;
  return parseResult(json);
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  return runGeocoder(address);
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeocodeResult | null> {
  return runGeocoder(`${longitude},${latitude}`);
}
