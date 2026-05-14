import type { Metadata } from "next";
import { ServicesAndTariffsSection } from "@/components/pricing/services-and-tariffs-section";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { defaultSocialImageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "Услуги и тарифы",
  description:
    "Тарифы Крым Вокруг: размещение одного объекта по периоду, любое количество номеров внутри объявления, без комиссии с бронирований.",
  alternates: {
    canonical: buildCanonicalPath("/uslugi-i-tarify"),
  },
  openGraph: {
    type: "website",
    title: "Услуги и тарифы",
    description:
      "Сезонное, межсезонное и годовое размещение объекта на Крым Вокруг без оплаты за количество номеров.",
    url: "/uslugi-i-tarify",
    images: [defaultSocialImageMetadata],
  },
};

export const revalidate = 3600;

export default function ServicesAndTariffsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-14">
      <ServicesAndTariffsSection />
    </div>
  );
}
