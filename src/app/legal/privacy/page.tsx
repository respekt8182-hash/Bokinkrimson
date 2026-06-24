import type { Metadata } from "next";
import {
  RequisitesBlock,
  StandardLegalPage,
} from "@/components/legal/standard-legal-page";
import { legalConfig } from "@/config/legal";
import { buildCanonicalPath } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Политика обработки персональных данных",
  description: "Политика обработки персональных данных сайта Крым Вокруг.",
  alternates: { canonical: buildCanonicalPath("/legal/privacy") },
};

export default function PrivacyPolicyPage() {
  return (
    <StandardLegalPage
      pathname="/legal/privacy"
      title="Политика обработки персональных данных"
      description="Документ описывает категории данных, цели обработки, хранение, передачу и права субъектов данных на сайте Крым Вокруг."
      version={legalConfig.documents.privacyVersion}
      sections={[
        {
          id: "operator",
          title: "Оператор",
          body: <RequisitesBlock />,
        },
        {
          id: "data",
          title: "Какие данные обрабатываются",
          body: (
            <ul className="list-disc space-y-2 pl-6">
              <li>данные аккаунта: имя, фамилия, телефон, email, пароль в защищенном виде;</li>
              <li>данные карточек: адрес, контакты, мессенджеры, фото, описания, цены, правила;</li>
              <li>заявки туристов: даты, количество гостей, имя, телефон, email, комментарий;</li>
              <li>платежи за услуги платформы: сумма, услуга, тариф, провайдер, статус;</li>
              <li>технические данные: IP, User-Agent, cookie, события безопасности и аналитики;</li>
              <li>сообщения поддержки, отзывы, жалобы, документы объекта при модерации.</li>
            </ul>
          ),
        },
        {
          id: "purposes",
          title: "Цели обработки",
          body: (
            <ol className="space-y-3">
              <li>регистрация, авторизация и ведение личного кабинета;</li>
              <li>публикация и модерация карточек;</li>
              <li>передача запросов владельцам и организаторам;</li>
              <li>оказание платных услуг платформы и учет оплаты;</li>
              <li>поддержка, рассмотрение претензий, предотвращение злоупотреблений;</li>
              <li>аналитика и улучшение сайта только после соответствующего opt-in.</li>
            </ol>
          ),
        },
        {
          id: "consent",
          title: "Согласия",
          body: (
            <p>
              Использование сайта само по себе не заменяет отдельное согласие там, где оно требуется.
              Формы должны запрашивать явное подтверждение без заранее отмеченных checkbox.
              Маркетинговое согласие является необязательным.
            </p>
          ),
        },
        {
          id: "processors",
          title: "Передача обработчикам",
          body: (
            <p>
              Для работы сайта могут использоваться YooKassa, Yandex Maps/Geocoder, Yandex Metrika
              после opt-in, SMTP, S3-compatible storage, хостинг и Redis/rate-limit сервисы.
              Фактические страны размещения должны быть подтверждены владельцем.
            </p>
          ),
        },
        {
          id: "rights",
          title: "Права субъекта данных",
          body: (
            <p>
              Субъект данных вправе запросить информацию об обработке, уточнение, ограничение,
              удаление данных или отзыв согласия по адресу {legalConfig.owner.contactEmail}. Если
              существуют законные основания хранения, удаление может быть ограничено.
            </p>
          ),
        },
      ]}
    />
  );
}
