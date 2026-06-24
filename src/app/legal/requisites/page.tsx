import type { Metadata } from "next";
import {
  RequisitesBlock,
  StandardLegalPage,
} from "@/components/legal/standard-legal-page";
import { getOwnerNpdStatement, legalConfig } from "@/config/legal";
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
      description="Публичные реквизиты владельца сайта и порядок связи по претензиям и поддержке."
      version={legalConfig.documents.termsVersion}
      sections={[
        {
          id: "owner",
          title: "Владелец сайта",
          body: (
            <>
              <RequisitesBlock />
              <p>{getOwnerNpdStatement()}</p>
            </>
          ),
        },
        {
          id: "claims",
          title: "Обращения и претензии",
          body: (
            <ol className="space-y-3">
              <li>Претензии направляются на email {legalConfig.owner.contactEmail} и по почтовому адресу, указанному в конфигурации.</li>
              <li>Обращения поддержки принимаются через {legalConfig.owner.supportContact}.</li>
              <li>Ответ подготавливается после проверки фактов, приложений и статуса услуги платформы.</li>
            </ol>
          ),
        },
        {
          id: "receipt",
          title: "Чеки НПД",
          body: (
            <p>
              При оплате услуг платформы чек формируется в рамках режима НПД через подтвержденный
              механизм владельца сайта. Если автоматическая интеграция не настроена, требуется
              ручное формирование чека.
            </p>
          ),
        },
      ]}
    />
  );
}
