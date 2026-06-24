import type { Metadata } from "next";
import {
  PlatformModeNotice,
  RequisitesBlock,
  StandardLegalPage,
} from "@/components/legal/standard-legal-page";
import { getOwnerNpdStatement, legalConfig } from "@/config/legal";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import { defaultSocialImageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "Публичная оферта",
  description: "Публичная оферта сайта Крым Вокруг на оказание услуг платформы.",
  alternates: { canonical: buildCanonicalPath("/oferta") },
  openGraph: {
    type: "website",
    title: "Публичная оферта",
    description: "Условия оплаты услуг платформы Крым Вокруг.",
    url: "/oferta",
    images: [defaultSocialImageMetadata],
  },
};

export default function OfertaPage() {
  return (
    <StandardLegalPage
      pathname="/oferta"
      title="Публичная оферта на оказание услуг платформы"
      description="Оферта регулирует оплату собственных услуг сайта: размещение, продление и продвижение карточек, фотосъемку и иные отдельно описанные услуги платформы."
      version={legalConfig.documents.offerVersion}
      sections={[
        {
          id: "mode",
          title: "Модель сервиса",
          body: <PlatformModeNotice />,
        },
        {
          id: "executor",
          title: "Исполнитель",
          body: (
            <>
              <p>{getOwnerNpdStatement()}</p>
              <p>
                Исполнитель не указывает ОГРНИП, так как в конфигурации сайта владелец определен
                как физическое лицо, применяющее НПД, а не индивидуальный предприниматель.
              </p>
            </>
          ),
        },
        {
          id: "subject",
          title: "Предмет оферты",
          body: (
            <ol className="space-y-3">
              <li>
                Исполнитель оказывает услуги платформы: размещение карточки, продление размещения,
                продвижение карточки, фотосъемка, размещение дополнительного автомобиля и другие
                отдельно описанные услуги сайта.
              </li>
              <li>
                Оплата проживания, экскурсий или иных услуг владельцев объектов через эту оферту не
                принимается.
              </li>
              <li>
                Сайт не получает комиссию от стоимости проживания в рамках текущей модели
                `LEAD_DIRECTORY`.
              </li>
            </ol>
          ),
        },
        {
          id: "accept",
          title: "Акцепт и согласия",
          body: (
            <ol className="space-y-3">
              <li>
                Акцепт оферты происходит при оплате конкретной услуги платформы после явного
                подтверждения условий оферты.
              </li>
              <li>
                Согласие на обработку персональных данных, согласие на распространение публичных
                данных и маркетинговое согласие оформляются отдельно, если применимы к форме.
              </li>
              <li>Checkbox согласия не должен быть отмечен заранее.</li>
            </ol>
          ),
        },
        {
          id: "payment",
          title: "Оплата и чеки НПД",
          body: (
            <ol className="space-y-3">
              <li>Оплата производится только за выбранную услугу платформы.</li>
              <li>
                После подтверждения платежа сайт должен сохранить заказ, плательщика, наименование
                услуги, сумму, версию принятой оферты и доказательства согласий.
              </li>
              <li>
                Чек НПД формируется владельцем сайта через подтвержденный механизм. Если
                автоматическая интеграция не настроена, создается задача на ручное формирование
                чека.
              </li>
            </ol>
          ),
        },
        {
          id: "refund",
          title: "Возвраты",
          body: (
            <p>
              Возвраты по услугам платформы оформляются отдельным обращением и рассматриваются по
              правилам документа <a href="/legal/refund" className="font-semibold text-terra hover:underline">/legal/refund</a>.
              Возвраты оплаты проживания не обрабатываются сайтом, так как сайт такую оплату не
              принимает.
            </p>
          ),
        },
        {
          id: "requisites",
          title: "Реквизиты",
          body: <RequisitesBlock />,
        },
      ]}
    />
  );
}
