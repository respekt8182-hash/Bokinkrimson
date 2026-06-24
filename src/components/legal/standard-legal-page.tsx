import type React from "react";
import Link from "next/link";
import { LegalDocumentLayout, LegalSection } from "@/components/legal/legal-document-layout";
import {
  getDocumentMeta,
  getOwnerNpdStatement,
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
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
      Документ является проектом для проверки юристом. Размещение этого текста на сайте не является
      гарантией полного соответствия законодательству.
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
      <DraftLegalNotice />
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
        {legalConfig.business.brandName} работает как каталог объявлений и передает запросы
        владельцам объектов или организаторам. Сайт не подтверждает бронирование проживания, не
        принимает оплату проживания и не является стороной договора проживания.
      </p>
      <p className="mt-1">
        Договор проживания заключается непосредственно между туристом и владельцем объекта.
      </p>
    </div>
  );
}

export function RequisitesBlock() {
  return (
    <div className="rounded-2xl bg-cream/72 p-5 text-sm leading-7 text-olive/80 ring-1 ring-olive/10">
      <p className="font-semibold text-olive">{getOwnerNpdStatement()}</p>
      <p className="mt-2">Email: {legalConfig.owner.contactEmail}</p>
      <p>Телефон: {legalConfig.owner.contactPhone}</p>
      <p>Адрес для претензий: {legalConfig.owner.claimsPostalAddress}</p>
      <p>Поддержка: {legalConfig.owner.supportContact}</p>
      <p className="mt-2">
        Полные реквизиты:{" "}
        <Link href="/legal/requisites" className="font-semibold text-terra hover:underline">
          /legal/requisites
        </Link>
      </p>
    </div>
  );
}
