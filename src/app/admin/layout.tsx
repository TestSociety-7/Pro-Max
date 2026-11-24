import type { Metadata, Viewport } from "next";
import "@fontsource-variable/alexandria";
import { ICON_METADATA } from "@/lib/pwa";
import "./admin.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "لوحة التحكم | Pro Max",
  robots: { index: false, follow: false },
  icons: ICON_METADATA,
  appleWebApp: { capable: true, title: "PM Admin", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#08080a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="manifest" href="/admin/manifest.webmanifest" crossOrigin="use-credentials" />
      </head>
      <body className="admin">{children}</body>
    </html>
  );
}
