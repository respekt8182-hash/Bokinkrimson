import type { Metadata, Viewport } from "next";
import { Manrope, Yeseva_One } from "next/font/google";
import { Suspense } from "react";
import { CookieConsentBanner } from "@/components/legal/cookie-consent-banner";
import { RootShell } from "@/components/layout/root-shell";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { JsonLd } from "@/components/seo/JsonLd";
import { assertLegalConfigForProduction } from "@/config/legal";
import { defaultSocialImage } from "@/lib/seo/metadata";
import { absoluteUrl, resolveMetadataBase, siteConfig } from "@/lib/seo/site";
import {
  buildOrganizationStructuredData,
  buildWebsiteStructuredData,
} from "@/lib/seo/structured-data";
import { getSupportChatSettings } from "@/lib/support-chat";
import "./globals.css";

assertLegalConfigForProduction();

const bodyFont = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
});

const headingFont = Yeseva_One({
  subsets: ["latin", "cyrillic"],
  variable: "--font-serif",
  weight: "400",
});

const faviconVersion = "20260428";
const versionedFavicon = (path: string) => `${path}?v=${faviconVersion}`;

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: {
    default: siteConfig.defaultTitle,
    template: siteConfig.titleTemplate,
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
    date: false,
  },
  description: siteConfig.shortDescription,
  applicationName: siteConfig.name,
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.shortDescription,
    url: absoluteUrl("/"),
    siteName: siteConfig.name,
    locale: "ru_RU",
    type: "website",
    images: [
      {
        url: defaultSocialImage.url,
        alt: siteConfig.name,
        width: defaultSocialImage.width,
        height: defaultSocialImage.height,
        type: defaultSocialImage.type,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.shortDescription,
    images: [defaultSocialImage.url],
  },
  icons: {
    icon: [
      { url: versionedFavicon("/favicon.svg"), type: "image/svg+xml", sizes: "any" },
      {
        url: versionedFavicon("/favicon.ico"),
        type: "image/x-icon",
        sizes: "16x16 32x32 120x120",
      },
      { url: versionedFavicon("/favicon-32x32.png"), type: "image/png", sizes: "32x32" },
      { url: versionedFavicon("/favicon-120x120.png"), type: "image/png", sizes: "120x120" },
    ],
    shortcut: [{ url: versionedFavicon("/favicon.ico"), type: "image/x-icon" }],
    apple: [
      { url: versionedFavicon("/apple-touch-icon.png"), sizes: "180x180", type: "image/png" },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supportChatSettings = await getSupportChatSettings();

  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className="scroll-smooth"
      data-scroll-behavior="smooth"
    >
      <head>
        <link rel="dns-prefetch" href="https://mc.yandex.ru" />
        <link rel="dns-prefetch" href="https://api-maps.yandex.ru" />
      </head>
      <body
        className={`${bodyFont.variable} ${headingFont.variable} min-h-screen overflow-x-clip bg-cream text-olive antialiased`}
      >
        <JsonLd data={[buildOrganizationStructuredData(), buildWebsiteStructuredData()]} />
        {/* Global SVG defs for clip-paths */}
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <defs>
            <clipPath id="heart-clip" clipPathUnits="objectBoundingBox">
              <path d="M0.5,0.92 C0.5,0.92,0.01,0.62,0.01,0.36 C0.01,0.17,0.14,0.04,0.29,0.04 C0.38,0.04,0.45,0.1,0.5,0.18 C0.55,0.1,0.62,0.04,0.71,0.04 C0.86,0.04,0.99,0.17,0.99,0.36 C0.99,0.62,0.5,0.92,0.5,0.92Z" />
            </clipPath>
          </defs>
        </svg>
        <Suspense fallback={null}>
          <RootShell
            header={<SiteHeader />}
            footer={<SiteFooter />}
            supportChatEnabled={supportChatSettings.enabled}
          >
            {children}
          </RootShell>
        </Suspense>
        <CookieConsentBanner />
      </body>
    </html>
  );
}
