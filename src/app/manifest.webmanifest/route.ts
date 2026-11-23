import { getSettings } from "@/lib/db";
import { APP_ICONS, manifestResponse } from "@/lib/pwa";

export const dynamic = "force-dynamic";

export async function GET() {
  let name = "Pro Max";
  try {
    name = (await getSettings()).storeName || name;
  } catch {
    // database not connected yet: keep the default name
  }
  return manifestResponse({
    id: "/",
    name,
    short_name: name.slice(0, 12),
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#060505",
    theme_color: "#060505",
    icons: APP_ICONS,
  });
}
