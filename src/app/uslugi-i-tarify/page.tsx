import type { Metadata } from "next";
import { ServicesAndTariffsSection } from "@/components/pricing/services-and-tariffs-section";
import { buildCanonicalPath } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Услуги и тарифы",
  description:
    "Тарифы на размещение объектов, экскурсий и туров на сайте Крым Вокруг с открытой моделью оплаты без комиссии с бронирования.",
  alternates: {
    canonical: buildCanonicalPath("/uslugi-i-tarify"),
  },
  openGraph: {
    type: "website",
    title: "Услуги и тарифы",
    description:
      "Актуальные тарифы на размещение объектов, экскурсий и туров на Крым Вокруг.",
    url: "/uslugi-i-tarify",
  },
};

export default function ServicesAndTariffsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-14">
      <ServicesAndTariffsSection />
    </div>
  );
}
