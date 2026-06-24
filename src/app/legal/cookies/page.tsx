import type { Metadata } from "next";
import { StandardLegalPage } from "@/components/legal/standard-legal-page";
import { legalConfig } from "@/config/legal";
import { buildCanonicalPath } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Cookie policy",
  description: "Политика использования cookies на сайте Крым Вокруг.",
  alternates: { canonical: buildCanonicalPath("/legal/cookies") },
};

export default function CookiesPage() {
  return (
    <StandardLegalPage
      pathname="/legal/cookies"
      title="Политика cookies"
      description="Правила использования обязательных и аналитических cookies."
      version={legalConfig.documents.cookiePolicyVersion}
      sections={[
        {
          id: "necessary",
          title: "Обязательные cookies",
          body: <p>Используются для авторизации, безопасности, работы личного кабинета и сохранения технических настроек. Они не отключаются через баннер.</p>,
        },
        {
          id: "analytics",
          title: "Аналитические cookies",
          body: <p>Yandex Metrika и аналогичные аналитические инструменты запускаются только после opt-in. Отказ не блокирует основной функционал сайта.</p>,
        },
        {
          id: "settings",
          title: "Настройки",
          body: <p>Пользователь может изменить выбор через кнопку &quot;Настройки cookies&quot; в footer сайта.</p>,
        },
      ]}
    />
  );
}
