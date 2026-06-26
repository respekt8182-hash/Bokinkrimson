import type { Metadata } from "next";
import { StandardLegalPage } from "@/components/legal/standard-legal-page";
import { legalConfig } from "@/config/legal";
import { buildCanonicalPath } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Согласие на обработку персональных данных",
  description: "Согласие на обработку персональных данных на сайте Крым Вокруг.",
  alternates: { canonical: buildCanonicalPath("/legal/personal-data-consent") },
};

export default function PersonalDataConsentPage() {
  return (
    <StandardLegalPage
      pathname="/legal/personal-data-consent"
      title="Согласие на обработку персональных данных"
      description="Отдельное согласие для форм регистрации, заявок, поддержки, оплаты услуг платформы и публикации карточек."
      version={legalConfig.documents.personalDataConsentVersion}
      sections={[
        {
          id: "scope",
          title: "Состав данных",
          body: (
            <p>
              Согласие может охватывать имя, телефон, email, данные заявки, данные аккаунта,
              сведения карточки, платежные сведения по услугам платформы, IP, User-Agent и URL
              страницы, на которой дано согласие.
            </p>
          ),
        },
        {
          id: "evidence",
          title: "Фиксация согласия",
          body: (
            <p>
              При предоставлении согласия сохраняются идентификатор документа, версия, URL формы,
              цель обработки, перечень данных, дата и время, IP, User-Agent, источник формы и факт
              активного действия пользователя. Поле подтверждения отображается пустым до выбора
              пользователя.
            </p>
          ),
        },
        {
          id: "withdraw",
          title: "Отзыв",
          body: (
            <p>
              Согласие можно отозвать через обращение на {legalConfig.owner.contactEmail}. Отзыв не
              влияет на обработку, которая требуется законом или необходима для защиты прав сторон.
            </p>
          ),
        },
      ]}
    />
  );
}
