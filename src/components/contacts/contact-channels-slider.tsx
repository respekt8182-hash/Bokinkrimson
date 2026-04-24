import { Phone } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ContactBrandMark, type ContactBrand } from "@/components/ui/contact-brand-mark";
import { cn } from "@/lib/cn";

export type ContactChannelsSliderItem = {
  id: string;
  href: string;
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  brand?: ContactBrand;
  isPhone?: boolean;
  external?: boolean;
  className?: string;
  iconClassName?: string;
};

type ContactChannelsSliderProps = {
  items: ContactChannelsSliderItem[];
  className?: string;
};

export function ContactChannelsSlider({ items, className }: ContactChannelsSliderProps) {
  if (items.length === 0) {
    return null;
  }

  const singleItem = items.length === 1;

  return (
    <div
      className={cn(
        "-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <div
        className={cn(
          singleItem
            ? "grid grid-cols-1"
            : "grid auto-cols-[minmax(220px,1fr)] grid-flow-col gap-3 snap-x snap-mandatory",
        )}
      >
        {items.map((item) => (
          <a
            key={item.id}
            href={item.href}
            target={item.external === false ? undefined : "_blank"}
            rel={item.external === false ? undefined : "noreferrer noopener"}
            className={cn(
              "group flex min-h-[104px] flex-col justify-between rounded-[24px] border border-olive/10 bg-white px-4 py-3.5 shadow-[0_12px_28px_rgba(58,43,35,0.05)] transition hover:-translate-y-0.5 hover:border-olive/18 hover:shadow-[0_16px_32px_rgba(58,43,35,0.08)]",
              !singleItem && "snap-start",
              item.className,
            )}
          >
            <span
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(15,118,110,0.08))] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]",
                item.iconClassName,
              )}
            >
              {item.isPhone ? (
                <AppIcon icon={Phone} className="h-5 w-5 text-primary" />
              ) : item.brand ? (
                <ContactBrandMark brand={item.brand} bare className="h-5 w-5" />
              ) : null}
            </span>

            <div className="mt-4 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/40">
                {item.eyebrow}
              </p>
              <p className="line-clamp-2 text-sm font-semibold leading-5 text-olive">
                {item.title}
              </p>
              {item.subtitle ? (
                <p className="text-xs leading-5 text-olive/55">{item.subtitle}</p>
              ) : null}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
