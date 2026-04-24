import Link from "next/link";
import { cn } from "@/lib/cn";

export type SeoBreadcrumbItem = {
  name: string;
  path: string;
};

type SeoBreadcrumbsProps = {
  items: SeoBreadcrumbItem[];
  className?: string;
};

export function SeoBreadcrumbs({ items, className }: SeoBreadcrumbsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Хлебные крошки"
      className={cn(
        "-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <ol className="flex min-w-max items-center gap-2 text-sm">
        {items.map((breadcrumb, index) => {
          const isLast = index === items.length - 1;

          return [
            <li key={`${breadcrumb.path}-${index}`}>
              {isLast ? (
                <span
                  className="inline-flex max-w-[min(72vw,26rem)] items-center truncate rounded-full bg-gradient-to-r from-cream via-white to-primary/8 px-3.5 py-1.5 font-semibold text-olive ring-1 ring-olive/10"
                  title={breadcrumb.name}
                >
                  {breadcrumb.name}
                </span>
              ) : (
                <Link
                  href={breadcrumb.path}
                  className="inline-flex items-center rounded-full border border-olive/12 bg-white/92 px-3 py-1.5 text-olive/72 shadow-[0_10px_24px_rgba(58,43,35,0.05)] transition hover:border-primary/18 hover:bg-cream hover:text-olive"
                >
                  {breadcrumb.name}
                </Link>
              )}
            </li>,
            !isLast ? (
              <li
                key={`${breadcrumb.path}-${index}-separator`}
                aria-hidden="true"
                className="text-base leading-none text-olive/24"
              >
                ›
              </li>
            ) : null,
          ];
        })}
      </ol>
    </nav>
  );
}
