import type { Metadata } from "next";
import { StandardLegalPage } from "@/components/legal/standard-legal-page";
import { legalConfig } from "@/config/legal";
import { buildCanonicalPath } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Маркетинговое согласие",
  description: "Согласие на рекламные и информационные сообщения сайта Крым Вокруг.",
  alternates: { canonical: buildCanonicalPath("/legal/marketing-consent") },
};

export default function MarketingConsentPage() {
  return (
    <StandardLegalPage
      pathname="/legal/marketing-consent"
      title="Маркетинговое согласие"
      description="Необязательное согласие на получение рекламных и информационных сообщений."
      version={legalConfig.documents.marketingConsentVersion}
      sections={[
        {
          id: "optional",
          title: "Необязательный характер",
          body: <p>Отказ от маркетингового согласия не должен блокировать регистрацию, заявку или оплату услуги платформы.</p>,
        },
        {
          id: "channels",
          title: "Каналы связи",
          body: <p>Сообщения могут направляться на email, телефон или в мессенджеры только при наличии отдельного согласия и технической возможности отписки.</p>,
        },
        {
          id: "withdraw",
          title: "Отзыв",
          body: <p>Согласие можно отозвать по адресу {legalConfig.owner.contactEmail} или через предусмотренную ссылку отписки.</p>,
        },
      ]}
    />
  );
}
