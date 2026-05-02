"use client";

import { Globe } from "lucide-react";
import { useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";
import { buildWebsiteFaviconUrl } from "@/lib/website-favicon";

type ContactWebsiteMarkProps = {
  websiteUrl: string | null | undefined;
  className?: string;
  imageClassName?: string;
  iconClassName?: string;
};

export function ContactWebsiteMark({
  websiteUrl,
  className,
  imageClassName,
  iconClassName,
}: ContactWebsiteMarkProps) {
  const faviconUrl = buildWebsiteFaviconUrl(websiteUrl);
  const [failedFaviconUrl, setFailedFaviconUrl] = useState<string | null>(null);
  const shouldShowFavicon = Boolean(faviconUrl && faviconUrl !== failedFaviconUrl);

  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", className)}>
      {shouldShowFavicon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={faviconUrl!}
          alt=""
          aria-hidden="true"
          className={cn("h-full w-full rounded-sm object-contain", imageClassName)}
          onError={() => setFailedFaviconUrl(faviconUrl)}
        />
      ) : (
        <AppIcon icon={Globe} className={cn("h-full w-full", iconClassName)} />
      )}
    </span>
  );
}
