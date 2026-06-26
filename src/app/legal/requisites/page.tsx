import type { Metadata } from "next";
import {
  RequisitesBlock,
  StandardLegalPage,
} from "@/components/legal/standard-legal-page";
import { legalConfig } from "@/config/legal";
import { buildCanonicalPath } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Реквизиты",
  description: "Реквизиты владельца сайта Крым Вокруг.",
  alternates: { canonical: buildCanonicalPath("/legal/requisites") },
};

export default function RequisitesPage() {
  return (
    <StandardLegalPage
      pathname="/legal/requisites"
      title="Реквизиты"
      description="Публичные реквизиты владельца сайта и контакты для обращений."
      version={legalConfig.documents.termsVersion}
      sections={[
        {
          id: "owner",
          title: "Владелец сайта",
          body: <RequisitesBlock />,
        },
        {
          id: "claims",
          title: "Обращения",
          body: (
            <ol className="space-y-3">
              <li>Обращения по работе сайта и услугам платформы принимаются на {legalConfig.owner.contactEmail}.</li>
              <li>Юридически значимые сообщения направляются по подтвержденным контактам, указанным на этой странице.</li>
              <li>Ответ подготавливается после проверки фактов, приложений, статуса услуги и полномочий заявителя.</li>
            </ol>
          ),
        },
        {
          id: "receipts",
          title: "Чеки НПД",
          body: (
            <p>
              При оплате собственных услуг платформы чек формируется исполнителем в рамках режима
              НПД и направляется плательщику после подтверждения платежа.
            </p>
          ),
        },
      ]}
    />
  );
}
