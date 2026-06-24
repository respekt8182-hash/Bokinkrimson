import type { Metadata } from "next";
import { StandardLegalPage } from "@/components/legal/standard-legal-page";
import { legalConfig } from "@/config/legal";
import { buildCanonicalPath } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Порядок возврата",
  description: "Порядок возврата оплаты услуг платформы Крым Вокруг.",
  alternates: { canonical: buildCanonicalPath("/legal/refund") },
};

export default function RefundPage() {
  return (
    <StandardLegalPage
      pathname="/legal/refund"
      title="Порядок возврата оплаты услуг платформы"
      description="Возвраты относятся только к собственным услугам сайта. Оплату проживания сайт не принимает."
      version={legalConfig.documents.refundVersion}
      sections={[
        {
          id: "scope",
          title: "Область применения",
          body: <p>Документ применяется к размещению, продлению, продвижению карточек, фотосъемке и другим услугам платформы. Возвраты за проживание решаются между туристом и владельцем объекта.</p>,
        },
        {
          id: "request",
          title: "Обращение",
          body: (
            <p>
              Для возврата нужно направить обращение через форму{" "}
              <a href="/refund-request" className="font-semibold text-terra hover:underline">
                /refund-request
              </a>{" "}
              или на {legalConfig.owner.contactEmail} с номером заказа, услугой, суммой и
              основанием возврата.
            </p>
          ),
        },
        {
          id: "formula",
          title: "Предварительный расчет",
          body: (
            <p>
              Для периодических услуг применяется предварительная формула: оплаченная сумма минус
              стоимость фактически оказанного периода и документально подтвержденные расходы.
              Предварительный расчет не является окончательным решением по обращению.
            </p>
          ),
        },
        {
          id: "receipt",
          title: "Чек возврата",
          body: <p>При одобрении возврата создается чек возврата НПД или задача на его ручное формирование.</p>,
        },
      ]}
    />
  );
}
