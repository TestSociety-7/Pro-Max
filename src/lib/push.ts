import "server-only";
import * as webpush from "web-push";
import { deletePushSub, getVapidKeys, listPushSubs } from "./db";
import { SITE_URL } from "./site";

let configured: string | null = null;

export async function vapidPublicKey(): Promise<string> {
  const keys = await getVapidKeys(() => webpush.generateVAPIDKeys());
  if (configured !== keys.publicKey) {
    // Apple's push service rejects a made-up contact; use the store's real https address.
    webpush.setVapidDetails(SITE_URL.startsWith("https://") ? SITE_URL : "https://pro-max.store", keys.publicKey, keys.privateKey);
    configured = keys.publicKey;
  }
  return keys.publicKey;
}

export type PushResult = { devices: number; sent: number; removed: number; failed: number };

/** Send a notification to every admin device that turned alerts on. Never throws. */
export async function notifyAdmins(payload: { title: string; body: string; url: string; tag?: string }): Promise<PushResult> {
  const r: PushResult = { devices: 0, sent: 0, removed: 0, failed: 0 };
  try {
    const subs = await listPushSubs();
    r.devices = subs.length;
    if (!subs.length) return r;
    await vapidPublicKey();
    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(JSON.parse(s.data), body, { TTL: 60 * 60 * 24, urgency: "high", timeout: 8000 });
          r.sent++;
        } catch (err) {
          const e = err as { statusCode?: number; body?: string };
          if (e.statusCode === 404 || e.statusCode === 410) {
            await deletePushSub(s.endpoint); // device unsubscribed
            r.removed++;
          } else {
            r.failed++;
            console.warn("push failed", e.statusCode, String(e.body ?? "").slice(0, 200), new URL(s.endpoint).host);
          }
        }
      }),
    );
  } catch (err) {
    console.warn("notifyAdmins failed", err);
  }
  return r;
}
