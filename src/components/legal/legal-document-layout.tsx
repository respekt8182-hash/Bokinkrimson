import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type TocItem = {
  id: string;
  label: string;
};

type LegalDocumentLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  meta: Array<{ label: string; value: string }>;
  toc?: TocItem[];
  children: ReactNode;
  className?: string;
};

type LegalSectionProps = {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
};

export function LegalDocumentLayout({
  eyebrow,
  title,
  description,
  meta,
  toc = [],
  children,
  className,
}: LegalDocumentLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6 md:py-14">
      <article
        className={cn(
          "rounded-[32px] bg-white/94 p-6 shadow-[0_18px_46px_-36px_rgba(15,74,64,0.58)] ring-1 ring-olive/10 md:p-8",
          className,
        )}
      >
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-olive/45">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-heading text-3xl leading-tight text-olive md:text-5xl md:leading-[1.08]">
            {title}
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-olive/75 md:text-base">
            {description}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {meta.map((item) => (
              <div
                key={`${item.label}-${item.value}`}
                className="rounded-2xl bg-cream/72 px-4 py-3 ring-1 ring-olive/10"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-olive/45">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-olive">{item.value}</p>
              </div>
            ))}
          </div>

          {toc.length > 0 ? (
            <nav className="mt-6 flex flex-wrap gap-2">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="rounded-full border border-olive/12 bg-white px-3 py-1.5 text-sm text-olive/70 transition hover:bg-cream hover:text-olive"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}
        </header>

        <div className="mt-8 space-y-8">{children}</div>
      </article>
    </div>
  );
}

export function LegalSection({ id, title, children, className }: LegalSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 border-t border-olive/10 pt-8 first:border-t-0 first:pt-0",
        className,
      )}
    >
      <h2 className="text-2xl font-semibold text-olive md:text-3xl">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-olive/80 md:text-base">{children}</div>
    </section>
  );
}
