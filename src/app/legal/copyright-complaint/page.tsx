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
          title: "Состав обращения",
          body: (
            <ul className="list-disc space-y-2 pl-6">
              <li>сведения о заявителе и контакт для ответа;</li>
              <li>подтверждение полномочий правообладателя или представителя;</li>
              <li>точный URL спорного материала на сайте;</li>
              <li>описание нарушения и сведения о защищаемом объекте;</li>
              <li>документы или ссылки, подтверждающие права.</li>
            </ul>
          ),
        },
        {
          id: "review",
          title: "Рассмотрение",
          body: <p>Обращение направляется на {legalConfig.owner.contactEmail}. Администрация проверяет полномочия, сведения о материале и может временно ограничить доступ к спорному материалу на время проверки.</p>,
        },
        {
          id: "objection",
          title: "Возражение",
          body: <p>Партнер или автор материала может представить возражение и документы, подтверждающие правомерность размещения. После проверки материал остается ограниченным, восстанавливается или удаляется.</p>,
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
