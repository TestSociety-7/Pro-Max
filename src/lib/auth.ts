import "server-only";
import { createHmac, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

// Single-owner admin. The password hash and the cookie-signing secret live only
// in server environment variables; nothing here is sent to the browser.

const COOKIE = "pm_admin";
const SESSION_HOURS = 12;

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
  const payload = Buffer.from(JSON.stringify({ exp, v: credentialVersion() })).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  if (authConfigProblem()) return false;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp: number; v: string };
    return data.exp > Date.now() && data.v === credentialVersion();
  } catch {
    return false;
  }
}

/** Call at the top of every admin page and every admin server action. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip).digest("base64url").slice(0, 16);
}
