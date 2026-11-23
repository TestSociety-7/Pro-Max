// Shared home-screen app (PWA) settings. Both the store and the admin use the same icon set.
export const APP_ICONS = [
  { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
  { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export const ICON_METADATA = {
  icon: [
    { url: "/favicon.ico", sizes: "any" },
    { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
  ],
  apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
};

export function manifestResponse(manifest: Record<string, unknown>) {
  return new Response(JSON.stringify(manifest), {
    headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" },
  });
}
