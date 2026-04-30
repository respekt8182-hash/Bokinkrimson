import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";

type FirstListingPromoProps = {
  kind: "housing" | "excursions" | "transfers";
  className?: string;
};

export function FirstListingPromo({ kind, className }: FirstListingPromoProps) {
  const content =
    kind === "housing"
      ? {
          title: "Станьте первым, кто разместит объект на сайте",
          description:
            "Добавьте жильё в каталог Крым Вокруг и получите скидку на первое размещение от нашей команды.",
        }
      : kind === "transfers"
        ? {
            title: "Станьте первым, кто разместит трансфер",
            description:
              "Добавьте трансфер в каталог Крым Вокруг и получите скидку на первое размещение от нашей команды.",
          }
        : {
            title: "Станьте первым, кто разместит экскурсию или тур",
            description:
              "Добавьте программу в каталог Крым Вокруг и получите скидку на первое размещение от нашей команды.",
          };

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-primary/18 bg-[linear-gradient(135deg,rgba(15,118,110,0.12),rgba(255,255,255,0.96)_48%,rgba(193,109,74,0.1))] p-4 text-left shadow-[0_18px_42px_-34px_rgba(15,74,64,0.55)] sm:p-5",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_12px_24px_-18px_rgba(15,118,110,0.7)]">
            <AppIcon icon={BadgeCheck} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold leading-snug text-olive">{content.title}</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-olive/70">{content.description}</p>
          </div>
        </div>

        <Link
          href="/cooperation"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
        >
          Узнать о размещении
          <AppIcon icon={ArrowRight} className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
