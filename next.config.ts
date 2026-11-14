import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs"],
  poweredByHeader: false,
  // Güvenlik başlıkları (her sayfa ve API). Belge görüntüleyici aynı sitedeki /api/... adresini iframe'de açar:
  // bu yüzden çerçeveye yalnızca aynı site izinli. Kamera ve konum yalnızca sitenin kendisine (QR devriye).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()" },
        ],
      },
    ];
  },
  // yalnızca geliştirme: aynı Wi-Fi'deki telefondan (ör. devriye QR testi) dev sunucusuna erişim
  allowedDevOrigins: ["192.168.1.6"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
