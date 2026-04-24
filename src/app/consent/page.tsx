import type { Metadata } from "next";
import { LegalDocumentLayout, LegalSection } from "@/components/legal/legal-document-layout";
import { companyConfig } from "@/config/company";
import { buildCanonicalPath } from "@/lib/seo/canonical";

const publicationDate = new Date(companyConfig.legalDocumentPublishedAt);
const publicationDateLabel = publicationDate.toLocaleDateString("ru-RU");
const consentDescription = `Согласие на обработку персональных данных пользователей сайта ${companyConfig.brandName}.`;
const privacyUrl = `${companyConfig.baseUrl}/legal/privacy`;

export const metadata: Metadata = {
  title: "Согласие на обработку персональных данных",
  description: consentDescription,
  alternates: {
    canonical: buildCanonicalPath("/consent"),
  },
  openGraph: {
    type: "website",
    title: "Согласие на обработку персональных данных",
    description: consentDescription,
    url: "/consent",
  },
};

export default function ConsentPage() {
  return (
    <LegalDocumentLayout
      eyebrow="Документы"
      title="Согласие на обработку персональных данных"
      description={consentDescription}
      meta={[
        {
          label: "Владелец сайта",
          value: companyConfig.ownerName,
        },
        {
          label: "Email",
          value: companyConfig.supportEmail,
        },
        ...(companyConfig.phone
          ? [{ label: "Телефон", value: companyConfig.phone }]
          : []),
        {
          label: "Дата публикации",
          value: publicationDateLabel,
        },
        {
          label: "Основание",
          value: "Федеральный закон № 152-ФЗ от 27.07.2006",
        },
      ]}
    >
      <LegalSection id="consent-operator" title="Оператор персональных данных">
        <dl className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-cream/72 p-5 ring-1 ring-olive/10 md:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-olive/45">
              Оператор
            </dt>
            <dd className="mt-2 text-base font-semibold text-olive">
              {companyConfig.legalName}
            </dd>
          </div>

          <div className="rounded-3xl bg-cream/72 p-5 ring-1 ring-olive/10">
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-olive/45">
              ИНН
            </dt>
            <dd className="mt-2 text-sm leading-7 text-olive/80">
              {companyConfig.taxId}
            </dd>
          </div>

          <div className="rounded-3xl bg-cream/72 p-5 ring-1 ring-olive/10">
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-olive/45">
              Email
            </dt>
            <dd className="mt-2 text-sm leading-7 text-olive/80">
              <a
                href={`mailto:${companyConfig.supportEmail}`}
                className="font-semibold text-terra hover:underline"
              >
                {companyConfig.supportEmail}
              </a>
            </dd>
          </div>

          {companyConfig.phone && (
            <div className="rounded-3xl bg-cream/72 p-5 ring-1 ring-olive/10">
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-olive/45">
                Телефон
              </dt>
              <dd className="mt-2 text-sm leading-7 text-olive/80">
                {companyConfig.phone}
              </dd>
            </div>
          )}

          <div className="rounded-3xl bg-cream/72 p-5 ring-1 ring-olive/10">
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-olive/45">
              Сайт
            </dt>
            <dd className="mt-2 text-sm leading-7 text-olive/80">
              <a
                href={companyConfig.baseUrl}
                className="font-semibold text-terra hover:underline"
              >
                {companyConfig.domain}
              </a>
            </dd>
          </div>

          <div className="rounded-3xl bg-cream/72 p-5 ring-1 ring-olive/10 md:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-olive/45">
              Основание
            </dt>
            <dd className="mt-2 text-sm leading-7 text-olive/80">
              Федеральный закон № 152-ФЗ «О персональных данных» от 27.07.2006
            </dd>
          </div>
        </dl>

        <div className="rounded-3xl bg-white p-5 ring-1 ring-terra/15">
          <p>
            Согласие может быть отозвано в любое время путём направления письменного заявления
            на адрес электронной почты{" "}
            <a
              href={`mailto:${companyConfig.supportEmail}`}
              className="font-semibold text-terra hover:underline"
            >
              {companyConfig.supportEmail}
            </a>
            .
          </p>
        </div>
      </LegalSection>

      <LegalSection id="consent-text" title="Текст согласия">
        <p>
          Я, субъект персональных данных, в соответствии с Федеральным законом от 27 июля
          2006 года № 152-ФЗ «О персональных данных» предоставляю {companyConfig.legalName}{" "}
          (ИНН {companyConfig.taxId}), являющемуся владельцем сайта {companyConfig.brandName},{" "}
          расположенного в сети Интернет по адресу{" "}
          <a
            href={companyConfig.baseUrl}
            className="font-semibold text-terra hover:underline"
          >
            {companyConfig.domain}
          </a>{" "}
          (далее — Оператор), согласие на обработку персональных данных, указанных мной в
          формах обратной связи, веб-чате, при регистрации, подаче заявок и иных формах
          взаимодействия на Сайте.
        </p>

        <p>
          Состав предоставляемых мной персональных данных: фамилия, имя, отчество, адрес
          электронной почты, номер телефона, а также иные данные, добровольно указанные мной
          при использовании сервисов Сайта.
        </p>

        <p>
          Цели обработки персональных данных: регистрация и обслуживание учётной записи на
          Сайте; обработка обращений, заявок и отзывов Пользователя; обеспечение связи между
          пользователями сервиса, владельцами объектов размещения и организаторами экскурсий;
          оказание платных услуг по размещению информации на Сайте; обеспечение
          работоспособности и безопасности Сайта; улучшение качества сервиса и аналитика.
        </p>

        <p>
          Согласие предоставляется на совершение следующих действий (операций) с указанными в
          настоящем согласии персональными данными: сбор, систематизацию, накопление, хранение,
          уточнение (обновление, изменение), использование, передачу (предоставление, доступ),
          блокирование, удаление, уничтожение, осуществляемых как с использованием средств
          автоматизации (автоматизированная обработка), так и без использования таких средств
          (неавтоматизированная обработка).
        </p>

        <p>
          Я понимаю и соглашаюсь с тем, что предоставление Оператору какой-либо информации о
          себе, не являющейся контактной и не относящейся к целям настоящего согласия, а равно
          предоставление информации, относящейся к государственной, банковской и/или
          коммерческой тайне, информации о расовой и/или национальной принадлежности,
          политических взглядах, религиозных или философских убеждениях, состоянии здоровья,
          интимной жизни запрещено.
        </p>

        <p>
          В случае принятия мной решения о предоставлении Оператору какой-либо информации
          (каких-либо данных), я обязуюсь предоставлять исключительно достоверную и актуальную
          информацию и не вправе вводить Оператора в заблуждение в отношении своей личности,
          сообщать ложную или недостоверную информацию о себе.
        </p>

        <p>
          Я понимаю и соглашаюсь с тем, что Оператор не проверяет достоверность персональных
          данных, предоставляемых мной, и не имеет возможности оценивать мою дееспособность и
          исходит из того, что я предоставляю достоверные персональные данные и поддерживаю
          такие данные в актуальном состоянии.
        </p>

        <p>
          Согласие действует до достижения целей обработки или в случае утраты необходимости в
          достижении этих целей, если иное не предусмотрено федеральным законом.
        </p>

        <p>
          Согласие может быть отозвано мною в любое время на основании письменного заявления,
          направленного на адрес электронной почты{" "}
          <a
            href={`mailto:${companyConfig.supportEmail}`}
            className="font-semibold text-terra hover:underline"
          >
            {companyConfig.supportEmail}
          </a>
          .
        </p>

        <div className="rounded-3xl bg-cream/72 p-5 ring-1 ring-olive/10">
          <p className="text-sm leading-7 text-olive/75">
            Ознакомьтесь также с{" "}
            <a href={privacyUrl} className="font-semibold text-terra hover:underline">
              Политикой конфиденциальности
            </a>
            .
          </p>
        </div>
      </LegalSection>
    </LegalDocumentLayout>
  );
}
