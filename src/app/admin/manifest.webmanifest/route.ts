import { APP_ICONS, manifestResponse } from "@/lib/pwa";

export function GET() {
  return manifestResponse({
    id: "/admin",
    name: "لوحة تحكم Pro Max",
    short_name: "PM Admin",
    lang: "ar",
    dir: "rtl",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    background_color: "#08080a",
    theme_color: "#08080a",
    icons: APP_ICONS,
  });
}
