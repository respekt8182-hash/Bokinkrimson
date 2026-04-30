import type { Metadata, Viewport } from "next";
import { Manrope, Yeseva_One } from "next/font/google";
import Script from "next/script";
import { RootShell } from "@/components/layout/root-shell";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { JsonLd } from "@/components/seo/JsonLd";
import { absoluteUrl, resolveMetadataBase, siteConfig } from "@/lib/seo/site";
import {
  buildOrganizationStructuredData,
  buildWebsiteStructuredData,
} from "@/lib/seo/structured-data";
import "./globals.css";

const YANDEX_METRIKA_ID = 108582509;
const yandexMetrikaScript = `
  (function(m,e,t,r,i,k,a){
      m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
      m[i].l=1*new Date();
      for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
      k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);
  })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_ID}', 'ym');

  ym(${YANDEX_METRIKA_ID}, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: "dataLayer",
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true
  });
`;

const bodyFont = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
});

const headingFont = Yeseva_One({
  subsets: ["latin", "cyrillic"],
  variable: "--font-serif",
  weight: "400",
});

const defaultSocialImageUrl = absoluteUrl("/crimea-map-preview-realistic.webp");
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
        url: defaultSocialImageUrl,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.shortDescription,
    images: [defaultSocialImageUrl],
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
    apple: [{ url: versionedFavicon("/apple-touch-icon.png"), sizes: "180x180", type: "image/png" }],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        <link rel="dns-prefetch" href="https://api.yookassa.ru" />
        <link rel="preconnect" href="https://mc.yandex.ru" crossOrigin="" />
        <link rel="preconnect" href="https://api-maps.yandex.ru" crossOrigin="" />
        <meta property="og:image" content={defaultSocialImageUrl} />
        <meta property="og:image:alt" content={siteConfig.name} />
        <meta name="twitter:image" content={defaultSocialImageUrl} />
        <Script id="yandex-metrika" strategy="beforeInteractive">
          {yandexMetrikaScript}
        </Script>
      </head>
      <body
        className={`${bodyFont.variable} ${headingFont.variable} min-h-screen overflow-x-clip bg-cream text-olive antialiased`}
      >
        <noscript>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://mc.yandex.ru/watch/${YANDEX_METRIKA_ID}`}
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
        <JsonLd data={[buildOrganizationStructuredData(), buildWebsiteStructuredData()]} />
        {/* Global SVG defs for clip-paths */}
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <defs>
            <clipPath id="heart-clip" clipPathUnits="objectBoundingBox">
              <path d="M0.5,0.92 C0.5,0.92,0.01,0.62,0.01,0.36 C0.01,0.17,0.14,0.04,0.29,0.04 C0.38,0.04,0.45,0.1,0.5,0.18 C0.55,0.1,0.62,0.04,0.71,0.04 C0.86,0.04,0.99,0.17,0.99,0.36 C0.99,0.62,0.5,0.92,0.5,0.92Z" />
            </clipPath>
          </defs>
        </svg>
        <RootShell header={<SiteHeader />} footer={<SiteFooter />}>
          {children}
        </RootShell>
      </body>
    </html>
  );
}
