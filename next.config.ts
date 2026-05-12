// Next.js runtime configuration for application build and routing behavior.
import type { NextConfig } from "next";
import { getConfiguredPublicAssetOrigins } from "./src/lib/security-config";

function buildRemotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  return getConfiguredPublicAssetOrigins().flatMap((origin) => {
    try {
      const url = new URL(origin);
      return [
        {
          protocol: url.protocol.replace(":", "") as "http" | "https",
          hostname: url.hostname,
          port: url.port,
          pathname: "/**",
        },
      ];
    } catch {
      return [];
    }
  });
}

function buildCspValue(): string {
  const publicAssetOrigins = getConfiguredPublicAssetOrigins();
  const assetSources = publicAssetOrigins.length > 0 ? ` ${publicAssetOrigins.join(" ")}` : "";
  const connectSources = [
    "'self'",
    "https://mc.yandex.ru",
    "https://mc.yandex.com",
    "wss://mc.yandex.ru",
    "wss://mc.yandex.com",
    "https://api-maps.yandex.ru",
    "https://geocode-maps.yandex.ru",
    ...publicAssetOrigins,
  ];

  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://mc.yandex.ru https://mc.yandex.com https://api-maps.yandex.ru https://yastatic.net https://*.maps.yandex.net",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https:${assetSources}`,
    `media-src 'self' data: blob: https:${assetSources}`,
    `connect-src ${connectSources.join(" ")}`,
    "font-src 'self' data:",
    "frame-src 'self' https://yandex.ru https://*.yandex.ru",
    "form-action 'self'",
  ];

  return policy.join("; ");
}

function buildSecurityHeaders() {
  const headers = [
    {
      key: "Content-Security-Policy",
      value: buildCspValue(),
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ];

  if (process.env.NODE_ENV === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains; preload",
    });
  }

  return headers;
}

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [72, 75],
    remotePatterns: buildRemotePatterns(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(),
      },
      {
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        source: "/Foto/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:file*.svg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
