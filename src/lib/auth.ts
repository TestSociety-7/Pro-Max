import "server-only";
import { createHmac, scryptSync, timingSafeEqual, createHash, randomBytes } from "node:crypto";
import { adminSessionValid, createAdminSession, deleteAdminSession, deleteAllAdminSessions } from "./db";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

// Single-owner admin. The password hash and the cookie-signing secret live only
// in server environment variables; nothing here is sent to the browser.

// "__Host-" cookies can only be set over HTTPS, for this exact host, on path "/".
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-pm_admin" : "pm_admin";
// The owner asked to stay signed in; sessions still end on logout or "sign out of all devices".
const SESSION_HOURS = 24 * 180;

export class AuthConfigError extends Error {}

function secret(): Buffer {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new AuthConfigError("المتغير SESSION_SECRET غير موجود أو أقصر من 32 حرفاً.");
  return Buffer.from(s);
}

export function authConfigProblem(): string | null {
  if ((process.env.SESSION_SECRET ?? "").length < 32)
    return "المتغير SESSION_SECRET غير موجود أو أقصر من 32 حرفاً.";
  if (!(process.env.ADMIN_PASSWORD_HASH ?? "").startsWith("scrypt:"))
    return "المتغير ADMIN_PASSWORD_HASH غير موجود. أضفه في إعدادات Vercel ثم أعد النشر.";
  return null;
}

export function verifyPassword(password: string): boolean {
  const stored = process.env.ADMIN_PASSWORD_HASH ?? "";
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nS, rS, pS, saltS, keyS] = parts;
  const N = Number(nS), r = Number(rS), p = Number(pS);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  const expected = Buffer.from(keyS, "base64url");
  const actual = scryptSync(password, Buffer.from(saltS, "base64url"), expected.length, {
    N,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Changes whenever the password hash changes, so rotating it signs everyone out. */
function credentialVersion(): string {
  return createHash("sha256").update(process.env.ADMIN_PASSWORD_HASH ?? "").digest("base64url").slice(0, 12);
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function startSession() {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const sid = randomBytes(24).toString("base64url");
  const agent = (await headers()).get("user-agent") ?? "";
  await createAdminSession(sid, exp, agent);
  const payload = Buffer.from(JSON.stringify({ exp, v: credentialVersion(), sid })).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax" so the cookie is also sent when the admin is opened from a link in
    // another app (WhatsApp, a notification, the home-screen icon). With "strict"
    // those visits arrived without the cookie and showed the login page.
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

async function readSession(): Promise<{ exp: number; v: string; sid: string } | null> {
  if (authConfigProblem()) return null;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw || raw.length > 600) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp: number; v: string; sid: string };
    if (!(data.exp > Date.now() && data.v === credentialVersion() && typeof data.sid === "string")) return null;
    return data;
  } catch {
    return null;
  }
}

export async function endSession() {
  const s = await readSession();
  if (s) await deleteAdminSession(s.sid).catch(() => {});
  (await cookies()).delete(COOKIE);
}

/** Sign out every device, including this one. */
export async function endAllSessions() {
  await deleteAllAdminSessions();
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const s = await readSession();
  if (!s) return false;
  try {
    return await adminSessionValid(s.sid);
  } catch (e) {
    // A brief database hiccup must not sign the owner out. The cookie is signed
    // and unexpired, so keep them in; a real logout still deletes the cookie.
    console.error("admin session check failed, keeping signed-in cookie:", e);
    return true;
  }
}

/** Call at the top of every admin page and every admin server action. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function clientKey(): Promise<string> {
  const h = await headers();
  // on Vercel x-real-ip is set by the platform and cannot be faked by the visitor
  const ip = h.get("x-real-ip") || (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  return createHash("sha256").update(ip).digest("base64url").slice(0, 16);
}
