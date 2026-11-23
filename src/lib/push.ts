import "server-only";
import * as webpush from "web-push";
import { deletePushSub, getVapidKeys, listPushSubs } from "./db";

let configured: string | null = null;

export async function vapidPublicKey(): Promise<string> {
  const keys = await getVapidKeys(() => webpush.generateVAPIDKeys());
  if (configured !== keys.publicKey) {
    webpush.setVapidDetails("mailto:admin@promax.invalid", keys.publicKey, keys.privateKey);
    configured = keys.publicKey;
  }
  return keys.publicKey;
}

/** Send a notification to every admin device that turned alerts on. Never throws. */
export async function notifyAdmins(payload: { title: string; body: string; url: string; tag?: string }) {
  try {
    const subs = await listPushSubs();
    if (!subs.length) return;
    await vapidPublicKey();
    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(JSON.parse(s.data), body, { TTL: 60 * 60 * 24, urgency: "high", timeout: 5000 });
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await deletePushSub(s.endpoint); // device unsubscribed
          else console.warn("push failed", code);
        }
      }),
    );
  } catch (err) {
    console.warn("notifyAdmins failed", err);
  }
}
