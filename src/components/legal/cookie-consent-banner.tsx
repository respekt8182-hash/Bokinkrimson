"use client";

import Script from "next/script";
import { useEffect, useState, useSyncExternalStore } from "react";
import { legalConfig } from "@/config/legal";

const STORAGE_KEY = "kv_cookie_consent_v1";
const YANDEX_METRIKA_ID = 108582509;

type CookieConsent = {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  policyVersion: string;
  consentId: string;
  updatedAt: string;
};

type CookieDraft = {
  functional: boolean;
  analytics: boolean;
};

function readConsent(): CookieConsent | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CookieConsent) : null;
  } catch {
    return null;
  }
}

function getConsentSnapshot(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

function subscribeConsent(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("kv-cookie-consent-updated", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("kv-cookie-consent-updated", callback);
    window.removeEventListener("storage", callback);
  };
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  document.cookie = `${name}=; Max-Age=0; path=/; domain=.${window.location.hostname}; SameSite=Lax`;
}

function clearAnalyticsCookies() {
  ["_ym_uid", "_ym_d", "_ym_isad", "_ym_visorc", "yandexuid", "yuidss"].forEach(deleteCookie);
}

function saveConsent(draft: CookieDraft) {
  const consent: CookieConsent = {
    necessary: true,
    functional: draft.functional,
    analytics: draft.analytics,
    policyVersion: legalConfig.documents.cookiePolicyVersion,
    consentId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  if (!consent.analytics) {
    clearAnalyticsCookies();
  }
  window.dispatchEvent(new Event("kv-cookie-consent-updated"));
  return consent;
}

const yandexMetrikaScript = `
  (function(m,e,t,r,i,k,a){
      m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
      m[i].l=1*new Date();
      for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
      k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);
  })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_ID}', 'ym');

  ym(${YANDEX_METRIKA_ID}, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: "dataLayer",
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true
  });
`;

export function CookieConsentBanner() {
  const consentSnapshot = useSyncExternalStore(subscribeConsent, getConsentSnapshot, () => "");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<CookieDraft>({ functional: false, analytics: false });
  const consent = consentSnapshot ? readConsent() : null;

  useEffect(() => {
    function openSettings() {
      const current = readConsent();
      setDraft({
        functional: current?.functional ?? false,
        analytics: current?.analytics ?? false,
      });
      setIsSettingsOpen(true);
    }

    window.addEventListener("kv-open-cookie-settings", openSettings);
    return () => {
      window.removeEventListener("kv-open-cookie-settings", openSettings);
    };
  }, []);

  const analyticsAllowed = Boolean(consent?.analytics);
  const showBanner = !consent || isSettingsOpen;

  return (
    <>
      {analyticsAllowed ? (
        <Script id="yandex-metrika" strategy="afterInteractive">
          {yandexMetrikaScript}
        </Script>
      ) : null}

      {showBanner ? (
        <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-3xl rounded-2xl border border-olive/12 bg-white p-4 shadow-[0_18px_50px_rgba(58,43,35,0.18)]">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-olive">Настройки cookies</p>
              <p className="mt-1 text-xs leading-5 text-olive/65">
                Обязательные cookies нужны для работы сайта и входа. Функциональные настройки и
                аналитика включаются только по вашему выбору. Версия политики:{" "}
                {legalConfig.documents.cookiePolicyVersion}.
              </p>
            </div>

            {isSettingsOpen ? (
              <div className="grid gap-2 rounded-2xl bg-cream/60 p-3 text-sm text-olive/75">
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked disabled className="mt-1" />
                  <span>
                    <span className="block font-semibold text-olive">Необходимые</span>
                    <span className="text-xs">Авторизация, безопасность, сохранение сессии.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={draft.functional}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, functional: event.target.checked }))
                    }
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold text-olive">Функциональные</span>
                    <span className="text-xs">Запоминание пользовательских настроек интерфейса.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={draft.analytics}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, analytics: event.target.checked }))
                    }
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold text-olive">Аналитика</span>
                    <span className="text-xs">Яндекс Метрика загружается только при включении.</span>
                  </span>
                </label>
              </div>
            ) : null}

            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  saveConsent({ functional: false, analytics: false });
                  setIsSettingsOpen(false);
                }}
                className="rounded-xl border border-olive/18 px-3 py-2 text-xs font-semibold text-olive transition hover:bg-cream"
              >
                Отклонить необязательные
              </button>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="rounded-xl border border-olive/18 px-3 py-2 text-xs font-semibold text-olive transition hover:bg-cream"
              >
                Настроить
              </button>
              <button
                type="button"
                onClick={() => {
                  saveConsent(isSettingsOpen ? draft : { functional: false, analytics: true });
                  setIsSettingsOpen(false);
                }}
                className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary/90"
              >
                Принять выбранные
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event("kv-open-cookie-settings"))}
    >
      Настройки cookies
    </button>
  );
}
