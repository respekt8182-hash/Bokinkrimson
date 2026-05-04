import type { Metadata } from "next";
import { ServicesAndTariffsSection } from "@/components/pricing/services-and-tariffs-section";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { defaultSocialImageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "Услуги и тарифы",
  description:
    "Тарифы на размещение объектов, экскурсий, туров и трансферов на сайте Крым Вокруг с открытой моделью оплаты без комиссии с бронирования.",
  alternates: {
    canonical: buildCanonicalPath("/uslugi-i-tarify"),
  },
  openGraph: {
    type: "website",
    title: "Услуги и тарифы",
    description:
      "Актуальные тарифы на размещение объектов, экскурсий, туров и трансферов на Крым Вокруг.",
    url: "/uslugi-i-tarify",
    images: [defaultSocialImageMetadata],
  },
};

export default function ServicesAndTariffsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-14">
      <ServicesAndTariffsSection />
    </div>
  );
}
