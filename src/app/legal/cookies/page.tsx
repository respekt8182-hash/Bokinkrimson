import type { Metadata } from "next";
import { CookieSettingsButton } from "@/components/legal/cookie-consent-banner";
import { StandardLegalPage } from "@/components/legal/standard-legal-page";
import { legalConfig } from "@/config/legal";
import { buildCanonicalPath } from "@/lib/seo/canonical";

const rows = [
  ["boking_session", "обязательные", "Крым Вокруг", "авторизация и безопасность сессии", "до окончания сессии", "да", "платформа", "выход из аккаунта или очистка cookies"],
  ["boking_admin_session", "обязательные", "Крым Вокруг", "авторизация администратора", "до окончания сессии", "да", "платформа", "выход из аккаунта или очистка cookies"],
  ["kv_cookie_consent_v1", "функциональные", "Крым Вокруг", "сохранение выбора по cookies и версии политики", "до изменения выбора или очистки хранилища", "нет", "платформа", "кнопка настроек cookies или очистка localStorage"],
  ["_ym_uid, _ym_d, _ym_isad, _ym_visorc", "аналитические", "Yandex Metrika", "аналитика посещений после согласия", "по правилам Яндекса и браузера", "нет", "Яндекс", "отключение аналитики в настройках cookies или очистка cookies"],
] as const;

export const metadata: Metadata = {
  title: "Политика cookies",
  description: "Политика использования cookies на сайте Крым Вокруг.",
  alternates: { canonical: buildCanonicalPath("/legal/cookies") },
};

export default function CookiesPage() {
  return (
    <StandardLegalPage
      pathname="/legal/cookies"
      title="Политика cookies"
      description="Правила использования обязательных, функциональных и аналитических cookies. Маркетинговые cookies в текущей конфигурации не используются."
      version={legalConfig.documents.cookiePolicyVersion}
      sections={[
        {
          id: "table",
          title: "Таблица cookies и хранилищ",
          body: (
            <div className="overflow-x-auto rounded-2xl border border-olive/10">
              <table className="min-w-[860px] border-collapse text-left text-sm">
                <thead className="bg-cream text-xs uppercase tracking-[0.12em] text-olive/60">
                  <tr>
                    <th className="px-3 py-3">Имя</th>
                    <th className="px-3 py-3">Категория</th>
                    <th className="px-3 py-3">Владелец</th>
                    <th className="px-3 py-3">Назначение</th>
                    <th className="px-3 py-3">Срок</th>
                    <th className="px-3 py-3">Обязательность</th>
                    <th className="px-3 py-3">Получатель</th>
                    <th className="px-3 py-3">Отключение</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row[0]} className="border-t border-olive/8">
                      {row.map((cell) => (
                        <td key={cell} className="px-3 py-3 align-top text-olive/78">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
        {
          id: "choice",
          title: "Выбор пользователя",
          body: (
            <p>
              Необязательные категории отключены до выбора пользователя. Сайт сохраняет версию
              cookie-политики, выбранные категории и время обновления выбора.{" "}
              <CookieSettingsButton className="font-semibold text-terra hover:underline" />
            </p>
          ),
        },
      ]}
    />
  );
}
