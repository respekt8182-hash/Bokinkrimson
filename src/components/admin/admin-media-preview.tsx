"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon } from "@/components/ui/lucide-react";
import { cn } from "@/lib/cn";

type AdminMediaPreviewProps = {
  src: string;
  alt: string;
  className: string;
  fallbackClassName?: string;
  fallbackLabel?: string;
};

export function AdminMediaPreview({
  src,
  alt,
  className,
  fallbackClassName,
  fallbackLabel = "Файл недоступен",
}: AdminMediaPreviewProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) {
      return;
    }

    if (image.complete && image.naturalWidth === 0) {
      const frame = window.requestAnimationFrame(() => {
        setHasError(true);
      });

      return () => {
        window.cancelAnimationFrame(frame);
      };
    }
  }, [src]);

  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 bg-cream px-4 text-center text-sm text-olive/60",
          fallbackClassName ?? className,
        )}
      >
        <ImageIcon className="h-4 w-4 shrink-0" />
        <span>{fallbackLabel}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imageRef}
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}
