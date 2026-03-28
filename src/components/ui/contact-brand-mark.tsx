// Reusable UI helper/component for contact brand mark.
import Image from "next/image";
import { cn } from "@/lib/cn";

export type ContactBrand = "whatsapp" | "telegram" | "vk" | "max" | "ok";

const contactBrandAssetById: Record<ContactBrand, { alt: string; src: string }> = {
  whatsapp: {
    alt: "WhatsApp",
    src: "/whatsapp-sign-logo.svg",
  },
  telegram: {
    alt: "Telegram",
    src: "/telegram-logo.svg",
  },
  vk: {
    alt: "VK",
    src: "/vk-logo.svg",
  },
  max: {
    alt: "Max",
    src: "/max-messenger-sign-logo.svg",
  },
  ok: {
    alt: "Одноклассники",
    src: "/ok-sign-logo.svg",
  },
};

type ContactBrandMarkProps = {
  brand: ContactBrand;
  className?: string;
  imageClassName?: string;
  bare?: boolean;
  size?: number;
};

export function ContactBrandMark({
  brand,
  className,
  imageClassName,
  bare = false,
  size = 20,
}: ContactBrandMarkProps) {
  const asset = contactBrandAssetById[brand];

  const image = (
    <Image
      src={asset.src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn(
        "contact-brand-image object-contain",
        bare ? "h-full w-full" : "h-[60%] w-[60%]",
        imageClassName,
      )}
    />
  );

  if (bare) {
    return <span className={cn("inline-flex shrink-0", className)}>{image}</span>;
  }

  return (
    <span
      className={cn(
        "contact-brand-shell inline-flex shrink-0 items-center justify-center rounded-[16px]",
        className,
      )}
      data-brand={brand}
    >
      {image}
    </span>
  );
}
