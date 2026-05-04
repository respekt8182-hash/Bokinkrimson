import type { Metadata } from "next";
import { absoluteUrl, siteConfig } from "@/lib/seo/site";

export const defaultSocialImagePath = "/social-preview-site-20260504.png";
export const defaultSocialImageUrl = absoluteUrl(defaultSocialImagePath);
export const defaultSocialImageMetadata = {
  url: defaultSocialImageUrl,
  alt: siteConfig.name,
  width: 1200,
  height: 630,
  type: "image/png",
} as const;
export const defaultSocialImage = {
  path: defaultSocialImagePath,
  ...defaultSocialImageMetadata,
} as const;

type BuildWebPageMetadataInput = {
  title: string;
  description: string;
  path: string;
  images?: string[];
  robots?: Metadata["robots"];
};

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:!?]+$/u, "").trim();
}

export function normalizeSeoText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function isUsefulSeoText(
  value: string | null | undefined,
  minLength = 70,
): boolean {
  const normalized = normalizeSeoText(value);
  if (normalized.length < minLength) {
    return false;
  }

  const lettersCount = (normalized.match(/[A-Za-zА-Яа-яЁё]/gu) ?? []).length;
  if (lettersCount < Math.max(32, Math.floor(minLength * 0.55))) {
    return false;
  }

  if (/(.)\1{4,}/u.test(normalized)) {
    return false;
  }

  const words = normalized
    .toLowerCase()
    .split(/\s+/)
    .map((item) => item.replace(/[^\p{L}\p{N}-]+/gu, ""))
    .filter((item) => item.length > 2);

  return new Set(words).size >= 4;
}

export function truncateSeoDescription(value: string, maxLength = 160): string {
  const normalized = normalizeSeoText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const slice = normalized.slice(0, maxLength).trim();
  const punctuationIndex = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  if (punctuationIndex >= Math.floor(maxLength * 0.55)) {
    return slice.slice(0, punctuationIndex + 1).trim();
  }

  const wordBoundaryIndex = slice.lastIndexOf(" ");
  if (wordBoundaryIndex >= Math.floor(maxLength * 0.55)) {
    return `${slice.slice(0, wordBoundaryIndex).trim()}...`;
  }

  return `${slice}...`;
}

export function buildSeoDescription(input: {
  preferred?: Array<string | null | undefined>;
  fallbackParts: Array<string | null | undefined>;
  maxLength?: number;
}): string {
  const preferred = input.preferred ?? [];

  for (const candidate of preferred) {
    if (isUsefulSeoText(candidate)) {
      return truncateSeoDescription(candidate!, input.maxLength);
    }
  }

  const uniqueParts = Array.from(
    new Set(
      input.fallbackParts
        .map((item) => trimTrailingPunctuation(normalizeSeoText(item)))
        .filter(Boolean),
    ),
  );
  const fallback = uniqueParts.join(". ");

  return truncateSeoDescription(fallback, input.maxLength);
}

export function buildWebPageMetadata({
  title,
  description,
  path,
  images,
  robots,
}: BuildWebPageMetadataInput): Metadata {
  const inputImages = images?.filter(Boolean);
  const socialImages = (inputImages?.length ? inputImages : [defaultSocialImageUrl]).map(
    (imageUrl) => {
      const absoluteImageUrl = absoluteUrl(imageUrl);
      const isDefaultImage = absoluteImageUrl === defaultSocialImageUrl;

      return {
        url: absoluteImageUrl,
        alt: title,
        ...(isDefaultImage
          ? {
              width: defaultSocialImage.width,
              height: defaultSocialImage.height,
              type: defaultSocialImage.type,
            }
          : {}),
      };
    },
  );

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    robots,
    openGraph: {
      type: "website",
      title,
      description,
      url: path,
      siteName: siteConfig.name,
      locale: "ru_RU",
      images: socialImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: socialImages.map((image) => image.url),
    },
  };
}
