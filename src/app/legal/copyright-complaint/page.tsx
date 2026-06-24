import type { Metadata } from "next";
import { StandardLegalPage } from "@/components/legal/standard-legal-page";
import { legalConfig } from "@/config/legal";
import { buildCanonicalPath } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Обращение правообладателя",
  description: "Порядок направления жалобы правообладателя на сайте Крым Вокруг.",
  alternates: { canonical: buildCanonicalPath("/legal/copyright-complaint") },
};

export default function CopyrightComplaintPage() {
  return (
    <StandardLegalPage
      pathname="/legal/copyright-complaint"
      title="Обращение правообладателя"
      description="Форма и порядок обращения при нарушении прав на фото, текст, товарный знак или иной материал."
      version={legalConfig.documents.copyrightComplaintVersion}
      sections={[
        {
          id: "how",
          title: "Как направить обращение",
          body: <p>Направьте письмо на {legalConfig.owner.contactEmail} с URL спорного материала, описанием права, подтверждающими документами и контактами заявителя.</p>,
        },
        {
          id: "review",
          title: "Рассмотрение",
          body: <p>Администрация проверяет обращение, может запросить дополнительные сведения и ограничить доступ к материалу на время проверки.</p>,
        },
        {
          id: "abuse",
          title: "Недобросовестные жалобы",
          body: <p>Заявитель отвечает за достоверность сведений и полномочия на обращение.</p>,
        },
      ]}
    />
  );
}
