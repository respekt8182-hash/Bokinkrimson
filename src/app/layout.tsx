import type { Metadata } from "next";
import { Manrope, Yeseva_One } from "next/font/google";
import { RootShell } from "@/components/layout/root-shell";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
});

const headingFont = Yeseva_One({
  subsets: ["latin", "cyrillic"],
  variable: "--font-serif",
  weight: "400",
});

function resolveMetadataBase(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: {
    default: "Крым Вокруг",
    template: "%s | Крым Вокруг",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
    date: false,
  },
  description: "krymvokrug.ru - бронирование жилья, гостиниц и экскурсии по Крыму у моря",
  applicationName: "Крым Вокруг",
  openGraph: {
    title: "Крым Вокруг",
    description: "Жилье, гостиницы и экскурсии по Крыму на одном сайте",
    url: "/",
    siteName: "Крым Вокруг",
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Крым Вокруг",
    description: "Жилье, гостиницы и экскурсии по Крыму на одном сайте",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Prevent false hydration warnings when browser extensions inject attributes into <html>.
    <html lang="ru" suppressHydrationWarning className="scroll-smooth">
      <body
        className={`${bodyFont.variable} ${headingFont.variable} min-h-screen bg-cream text-olive antialiased`}
      >
        <RootShell header={<SiteHeader />} footer={<SiteFooter />}>
          {children}
        </RootShell>
      </body>
    </html>
  );
}
