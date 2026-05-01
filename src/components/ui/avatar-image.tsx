"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type AvatarImageProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  children: ReactNode;
};

export function AvatarImage({ src, alt, className, children }: AvatarImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return <>{children}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setFailedSrc(src)} />
  );
}
