import type { Metadata } from "next";
import { FreePlacementGiveawayPage } from "@/components/contest/free-placement-giveaway-page";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { defaultSocialImageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "Розыгрыш бесплатного размещения на 365 дней",
  description:
    "Условия розыгрыша сертификата на бесплатное размещение на сайте Крым Вокруг сроком на 365 дней: подпишитесь на ВК, сделайте репост и дождитесь итогов 11 мая.",
  alternates: {
    canonical: buildCanonicalPath("/rozigrash"),
  },
  openGraph: {
    type: "website",
    title: "Розыгрыш бесплатного размещения на 365 дней",
    description:
      "Сертификат на размещение жилья, экскурсии, тура, трансфера или другого объекта на сайте Крым Вокруг.",
    url: "/rozigrash",
    locale: "ru_RU",
    images: [defaultSocialImageMetadata],
  },
};

export default function GiveawayPage() {
  return <FreePlacementGiveawayPage />;
}
