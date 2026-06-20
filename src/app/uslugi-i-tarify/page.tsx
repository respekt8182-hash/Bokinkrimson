import type { Metadata } from "next";
import { ServicesAndTariffsSection } from "@/components/pricing/services-and-tariffs-section";
import { getHomeStats } from "@/lib/home-stats";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { defaultSocialImageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "Услуги и тарифы",
  description:
    "Каждое новое объявление жилья, экскурсии, тура или трансфера на Крым Вокруг размещается бесплатно на 1 год с даты создания. Количество объявлений не ограничено.",
  alternates: {
    canonical: buildCanonicalPath("/uslugi-i-tarify"),
  },
  openGraph: {
    type: "website",
    title: "Услуги и тарифы",
    description:
      "Бесплатное размещение каждого нового объявления на 1 год: жильё, экскурсии, туры и трансферы.",
    url: "/uslugi-i-tarify",
    images: [defaultSocialImageMetadata],
  },
};

export const revalidate = 3600;

export default async function ServicesAndTariffsPage() {
  const { publishedPropertiesCount } = await getHomeStats();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-14">
      <ServicesAndTariffsSection publishedPropertiesCount={publishedPropertiesCount} />
    </div>
  );
}
