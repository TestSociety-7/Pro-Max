import type { Metadata, Viewport } from "next";
import "@fontsource-variable/alexandria"; // self-hosted, no runtime call to Google
import { getProduct, getSettings } from "@/lib/db";
import { ICON_METADATA } from "@/lib/pwa";
import { SITE_URL } from "@/lib/site";
import { Presence } from "./Presence";
import "./store.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [s, p] = await Promise.all([getSettings(), getProduct()]);
    const title = `${p.headline} | ${s.storeName}`;
    const description = [p.subheadline, "الدفع عند الاستلام."].filter(Boolean).join(" ");
    return {
      metadataBase: new URL(SITE_URL),
      alternates: { canonical: "/" },
      title,
      description,
      openGraph: { title, description, images: ["/og.jpg"], locale: "ar" },
      manifest: "/manifest.webmanifest",
      icons: ICON_METADATA,
      appleWebApp: { capable: true, title: s.storeName, statusBarStyle: "black-translucent" },
    };
  } catch {
    return { title: "Pro Max", manifest: "/manifest.webmanifest", icons: ICON_METADATA };
  }
}

export const viewport: Viewport = {
  themeColor: "#060505",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="store">
        {children}
        <Presence />
      </body>
    </html>
  );
}
