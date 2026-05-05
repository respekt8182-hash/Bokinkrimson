import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FreePlacementGiveawayPage } from "@/components/contest/free-placement-giveaway-page";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { defaultSocialImageMetadata } from "@/lib/seo/metadata";

const giveawayPageEnabled = false;

export const metadata: Metadata = {
  title: "Страница временно отключена",
  description: "Раздел временно отключен.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: buildCanonicalPath("/rozigrash"),
  },
  openGraph: {
    type: "website",
    title: "Страница временно отключена",
    description: "Раздел временно отключен.",
    url: "/rozigrash",
    locale: "ru_RU",
    images: [defaultSocialImageMetadata],
  },
};

export default function GiveawayPage() {
  if (!giveawayPageEnabled) {
    notFound();
  }

  return <FreePlacementGiveawayPage />;
}
