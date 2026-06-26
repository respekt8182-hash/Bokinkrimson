import type React from "react";
import Link from "next/link";
import { LegalDocumentLayout, LegalSection } from "@/components/legal/legal-document-layout";
import {
  getDocumentMeta,
  getOwnerNpdStatement,
  getPublicRequisites,
  legalConfig,
} from "@/config/legal";

export type StandardLegalPageProps = {
  pathname: string;
  title: string;
  description: string;
  version: string;
  sections: Array<{
    id: string;
    title: string;
    body: React.ReactNode;
  }>;
};

export function DraftLegalNotice() {
  return (
    <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-olive/78">
      Документ применяется к отношениям с пользователями и партнерами сайта с даты вступления в
      силу, указанной в шапке документа.
    </div>
  );
}

export function StandardLegalPage({
  pathname,
  title,
  description,
  version,
  sections,
}: StandardLegalPageProps) {
  return (
    <LegalDocumentLayout
      eyebrow="Юридический документ"
      title={title}
      description={description}
      meta={getDocumentMeta(version, pathname)}
      toc={sections.map((section) => ({ id: section.id, label: section.title }))}
    >
      {sections.map((section) => (
        <LegalSection key={section.id} id={section.id} title={section.title}>
          {section.body}
        </LegalSection>
      ))}
    </LegalDocumentLayout>
  );
}

export function PlatformModeNotice() {
  return (
    <div className="rounded-2xl bg-cream/72 p-4 text-sm leading-6 text-olive/75 ring-1 ring-olive/10">
      <p className="font-semibold text-olive">Фактическая модель сервиса</p>
      <p className="mt-1">
        {legalConfig.business.brandName} работает как информационная платформа и сервис размещения
        карточек жилья, экскурсий, туров и трансферов. Платформа предоставляет партнерам
        техническую возможность публиковать карточки, а посетителям - просматривать их и отправлять
        запросы соответствующему партнеру.
      </p>
      <p className="mt-1">
        Запрос через сайт сам по себе не является бронированием, акцептом предложения партнера или
        заключенным договором. Платформа не является гостиницей, туроператором, турагентом,
        перевозчиком, экскурсоводом или стороной договора между туристом и партнером.
      </p>
    </div>
  );
}

export function RequisitesBlock() {
  const requisites = getPublicRequisites();

  return (
    <div className="rounded-2xl bg-cream/72 p-5 text-sm leading-7 text-olive/80 ring-1 ring-olive/10">
      <p className="font-semibold text-olive">{getOwnerNpdStatement()}</p>
      <dl className="mt-3 grid gap-2">
        {requisites.map((item) => (
          <div key={item.label} className="grid gap-1 sm:grid-cols-[220px_1fr]">
            <dt className="text-olive/58">{item.label}</dt>
            <dd className="font-medium text-olive">{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2">Поддержка: {legalConfig.owner.supportContact}</p>
      <p className="mt-2">
        Полные реквизиты:{" "}
        <Link href="/legal/requisites" className="font-semibold text-terra hover:underline">
          /legal/requisites
        </Link>
      </p>
    </div>
  );
}
