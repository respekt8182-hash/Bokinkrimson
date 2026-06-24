import type { Metadata } from "next";
import { RefundRequestForm } from "@/components/legal/refund-request-form";
import { legalConfig } from "@/config/legal";
import { buildCanonicalPath } from "@/lib/seo/canonical";

export const metadata: Metadata = {
  title: "Заявление на возврат",
  description: "Форма обращения по возврату оплаты услуг платформы Крым Вокруг.",
  alternates: { canonical: buildCanonicalPath("/refund-request") },
};

export default function RefundRequestPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6 md:py-14">
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-olive/45">
            Возвраты
          </p>
          <h1 className="mt-3 font-heading text-4xl text-olive">Заявление на возврат</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-olive/70">
            Форма используется только для услуг сайта {legalConfig.business.brandName}. Оплата
            проживания через сайт не принимается, поэтому возвраты проживания рассматриваются
            напрямую владельцем объекта.
          </p>
        </div>
        <RefundRequestForm />
      </div>
    </main>
  );
}
