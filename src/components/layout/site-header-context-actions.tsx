"use client";

import { Check, ChevronLeft, Share2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { isPublicDetailRoute } from "@/components/layout/public-mobile-bottom-nav";
import { AppIcon } from "@/components/ui/app-icon";

function getFallbackHref(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "crimea" && segments[1] === "excursions") {
    return segments[2] ? `/excursions/${segments[2]}` : "/excursions";
  }

  if (segments[0] === "crimea") {
    return segments[1] ? `/crimea/${segments[1]}` : "/rent";
  }

  if (segments[0] === "transfers") {
    return "/transfers";
  }

  if (segments[0] === "attractions") {
    return "/attractions";
  }

  return "/";
}

export function SiteHeaderBackButton() {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  if (!isPublicDetailRoute(pathname)) {
    return null;
  }

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(getFallbackHref(pathname));
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Вернуться назад"
      title="Назад"
      className="icon-button-soft inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] focus-visible:outline-none lg:hidden"
    >
      <AppIcon icon={ChevronLeft} className="h-5 w-5 text-[color:var(--icon-nav)]" />
    </button>
  );
}

export function SiteHeaderShareButton() {
  const pathname = usePathname() ?? "";
  const [copied, setCopied] = useState(false);

  if (!isPublicDetailRoute(pathname)) {
    return null;
  }

  async function handleShare() {
    const url = window.location.href;
    const title = document.title;

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      aria-label={copied ? "Ссылка скопирована" : "Поделиться ссылкой"}
      title={copied ? "Ссылка скопирована" : "Поделиться"}
      className="icon-button-soft inline-flex h-11 w-11 items-center justify-center rounded-[15px] focus-visible:outline-none lg:hidden"
    >
      <AppIcon icon={copied ? Check : Share2} className="h-5 w-5 text-[color:var(--icon-info)]" />
    </button>
  );
}
