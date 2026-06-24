import type { Metadata } from "next";
import { StandardLegalPage } from "@/components/legal/standard-legal-page";
import { legalConfig } from "@/config/legal";
import { buildCanonicalPath } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Согласие на распространение публичных данных",
  description: "Согласие владельца карточки на публикацию контактов и сведений в каталоге.",
  alternates: { canonical: buildCanonicalPath("/legal/public-data-consent") },
};

export default function PublicDataConsentPage() {
  return (
    <StandardLegalPage
      pathname="/legal/public-data-consent"
      title="Согласие на распространение публичных данных"
      description="Документ нужен для публикации контактов и иных сведений владельца карточки в открытом каталоге."
      version={legalConfig.documents.publicDataConsentVersion}
      sections={[
        {
          id: "categories",
          title: "Разрешенные категории",
          body: (
            <ul className="list-disc space-y-2 pl-6">
              <li>название объекта или услуги;</li>
              <li>публичный адрес или район объекта;</li>
              <li>телефоны, email, мессенджеры и сайт, если владелец явно разрешил публикацию;</li>
              <li>фотографии, описания, правила и цены, предназначенные для карточки.</li>
            </ul>
          ),
        },
        {
          id: "limits",
          title: "Ограничения",
          body: (
            <p>
              Паспортные данные, документы объекта, закрытая переписка и служебные проверки не
              публикуются. Старые контакты без доказуемого согласия не должны автоматически
              считаться разрешенными к распространению.
            </p>
          ),
        },
        {
          id: "withdraw",
          title: "Отзыв",
          body: (
            <p>
              После отзыва согласия сайт должен скрыть соответствующие публичные контакты, если нет
              иного законного основания для их публикации.
            </p>
          ),
        },
      ]}
    />
  );
}
