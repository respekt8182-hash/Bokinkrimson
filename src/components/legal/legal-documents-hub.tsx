import Link from "next/link";
import { ArrowRight, FileText, Info, Landmark, ShieldCheck } from "lucide-react";
import { PlatformModeNotice } from "@/components/legal/standard-legal-page";
import { legalConfig } from "@/config/legal";
import { legalDocumentGroups } from "@/config/legal-documents";

const groupIcons = [ShieldCheck, FileText, Landmark] as const;

type LegalDocumentsHubProps = {
  canonicalPath: "/legal" | "/documents";
};

export function LegalDocumentsHub({ canonicalPath }: LegalDocumentsHubProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6 md:py-16">
      <section className="overflow-hidden rounded-[32px] border border-olive/10 bg-white/82 shadow-[0_28px_80px_-58px_rgba(58,43,35,0.45)]">
        <div className="border-b border-olive/10 bg-gradient-to-br from-cream via-white to-sand/45 px-5 py-7 md:px-8 md:py-10">
          <nav aria-label="Хлебные крошки" className="text-sm text-olive/55">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="transition hover:text-olive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/35">
                  Главная
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium text-olive">Документы</li>
            </ol>
          </nav>

          <div className="mt-7 flex max-w-4xl flex-col gap-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-terra/18 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-terra">
              <Info className="h-3.5 w-3.5" />
              Правовая информация
            </span>
            <h1 className="font-heading text-4xl leading-tight text-olive md:text-6xl">
              Документы
            </h1>
            <p className="max-w-3xl text-base leading-8 text-olive/70 md:text-lg">
              Здесь собраны юридические документы, правила использования сервиса, информация об
              обработке данных, оплате и возврате средств.
            </p>
          </div>

          <div className="mt-7 grid gap-3">
            <PlatformModeNotice />
          </div>
        </div>

        <div className="grid gap-5 bg-cream/35 px-5 py-6 md:grid-cols-2 md:px-8 md:py-8 xl:grid-cols-3">
          {legalDocumentGroups.map((group, index) => {
            const Icon = groupIcons[index] ?? ShieldCheck;

            return (
              <section
                key={group.title}
                aria-labelledby={`documents-${index}`}
                className="rounded-[24px] border border-olive/10 bg-white/72 p-4 shadow-[0_18px_44px_-38px_rgba(58,43,35,0.5)] md:p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 id={`documents-${index}`} className="text-xl font-semibold text-olive">
                      {group.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-olive/62">{group.description}</p>
                  </div>
                </div>

                <ul className="mt-5 space-y-2">
                  {group.links.map((item) => {
                    const isCurrentPage = item.href === canonicalPath;

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={isCurrentPage ? "page" : undefined}
                          className="group flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-sm font-semibold text-olive/72 transition duration-200 hover:border-olive/10 hover:bg-cream/70 hover:text-olive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/35"
                        >
                          <span>
                            <span className="block">{item.label}</span>
                            <span className="mt-0.5 block text-xs font-normal leading-5 text-olive/50">
                              {item.description}
                            </span>
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-terra/55 transition duration-200 group-hover:translate-x-1 group-hover:text-terra" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="border-t border-olive/10 bg-white/70 px-5 py-5 text-sm leading-7 text-olive/62 md:px-8">
          Документы сайта {legalConfig.business.brandName} опубликованы для удобного доступа
          пользователей, владельцев объектов и партнеров сервиса.
        </div>
      </section>
    </div>
  );
}
