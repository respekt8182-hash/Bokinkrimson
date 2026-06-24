import type { Metadata } from "next";
import {
  PlatformModeNotice,
  RequisitesBlock,
  StandardLegalPage,
} from "@/components/legal/standard-legal-page";
import { legalConfig } from "@/config/legal";
import { buildCanonicalPath } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Пользовательское соглашение",
  description: "Условия использования сайта Крым Вокруг.",
  alternates: { canonical: buildCanonicalPath("/legal/terms") },
};

export default function TermsPage() {
  return (
    <StandardLegalPage
      pathname="/legal/terms"
      title="Пользовательское соглашение"
      description="Соглашение определяет правила использования каталога, личного кабинета, карточек, заявок, отзывов и поддержки."
      version={legalConfig.documents.termsVersion}
      sections={[
        {
          id: "mode",
          title: "Роль сайта",
          body: <PlatformModeNotice />,
        },
        {
          id: "users",
          title: "Пользователи и владельцы карточек",
          body: (
            <ol className="space-y-3">
              <li>Пользователь может просматривать каталог и направлять запросы владельцам.</li>
              <li>
                Владелец карточки отвечает за достоверность данных, права на фотографии и наличие
                необходимых разрешений/реестров.
              </li>
              <li>
                Запрос через сайт не является подтвержденным бронированием или заключенным
                договором проживания.
              </li>
            </ol>
          ),
        },
        {
          id: "prohibited",
          title: "Запрещенные действия",
          body: (
            <ul className="list-disc space-y-2 pl-6">
              <li>публиковать чужие данные без правового основания;</li>
              <li>размещать недостоверные сведения об объекте, ценах, контактах или реестре;</li>
              <li>публиковать паспортные данные и иные избыточные чувствительные сведения;</li>
              <li>использовать сайт для спама, обхода защиты, сбора контактов или атак;</li>
              <li>публиковать материалы, нарушающие права третьих лиц.</li>
            </ul>
          ),
        },
        {
          id: "verification",
          title: "Модерация и проверка",
          body: (
            <p>
              Администрация может запросить подтверждение прав на размещаемую информацию и сведения
              для модерации карточки. Запрашиваемые данные должны быть минимальными и не
              публикуются на сайте. Паспортные данные не должны размещаться публично.
            </p>
          ),
        },
        {
          id: "liability",
          title: "Ответственность",
          body: (
            <p>
              Сайт предоставляет информационную платформу и не отвечает за договор проживания между
              туристом и владельцем объекта. Владелец карточки отвечает за свои сведения,
              предложения, контакты, цены и исполнение договоренностей с туристом.
            </p>
          ),
        },
        {
          id: "contacts",
          title: "Контакты",
          body: <RequisitesBlock />,
        },
      ]}
    />
  );
}
