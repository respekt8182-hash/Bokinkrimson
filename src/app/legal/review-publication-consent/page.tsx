import type { Metadata } from "next";
import { StandardLegalPage } from "@/components/legal/standard-legal-page";
import { legalConfig } from "@/config/legal";
import { buildCanonicalPath } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Согласие на публикацию отзыва",
  description: "Согласие автора на публикацию отзыва на сайте Крым Вокруг.",
  alternates: { canonical: buildCanonicalPath("/legal/review-publication-consent") },
};

export default function ReviewPublicationConsentPage() {
  return (
    <StandardLegalPage
      pathname="/legal/review-publication-consent"
      title="Согласие на публикацию отзыва"
      description="Документ определяет публикацию текста отзыва, оценки, имени автора и ответа владельца."
      version={legalConfig.documents.reviewPublicationConsentVersion}
      sections={[
        {
          id: "published",
          title: "Что публикуется",
          body: <p>Может публиковаться текст отзыва, оценка, имя или отображаемое имя автора, дата публикации и ответ владельца/организатора.</p>,
        },
        {
          id: "moderation",
          title: "Модерация",
          body: <p>Сайт может скрыть отзыв при нарушении правил, споре, жалобе, дублировании или признаках недостоверности.</p>,
        },
        {
          id: "withdraw",
          title: "Отзыв согласия",
          body: <p>Автор может обратиться на {legalConfig.owner.contactEmail}; отзыв согласия может привести к скрытию персональных элементов отзыва.</p>,
        },
      ]}
    />
  );
}
