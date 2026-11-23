import { leavePresence, touchPresence } from "@/lib/db";

export const dynamic = "force-dynamic";

const ID = /^[A-Za-z0-9_-]{16,40}$/;
const PATHS = new Set(["home", "order"]);

/** Store visitors ping this every ~25s so the admin can see who is on the site right now. */
export async function POST(req: Request) {
  // same-origin only
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return new Response(null, { status: 403 });

  let body: { id?: unknown; path?: unknown; bye?: unknown };
  try {
    const text = await req.text();
    if (text.length > 200) return new Response(null, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const id = typeof body.id === "string" && ID.test(body.id) ? body.id : null;
  if (!id) return new Response(null, { status: 400 });
  const path = typeof body.path === "string" && PATHS.has(body.path) ? body.path : "home";
  try {
    if (body.bye === true) await leavePresence(id);
    else await touchPresence(id, path);
  } catch {
    /* presence is best-effort */
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
