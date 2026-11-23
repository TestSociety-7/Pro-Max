import type { Metadata, Viewport } from "next";
import "@fontsource-variable/alexandria"; // self-hosted, no runtime call to Google
import { getProduct, getSettings } from "@/lib/db";
import "./store.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [s, p] = await Promise.all([getSettings(), getProduct()]);
    const title = `${p.headline} | ${s.storeName}`;
    const description = [p.subheadline, "الدفع عند الاستلام."].filter(Boolean).join(" ");
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
    return {
      metadataBase: host ? new URL(`https://${host}`) : undefined,
      title,
      description,
      openGraph: { title, description, images: ["/og.jpg"], locale: "ar" },
    };
  } catch {
    return { title: "Pro Max" };
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
      <body className="store">{children}</body>
    </html>
  );
}
