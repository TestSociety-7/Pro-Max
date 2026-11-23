"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  authConfigProblem,
  clientKey,
  endSession,
  requireAdmin,
  startSession,
  verifyPassword,
} from "@/lib/auth";
import {
  clearLoginFailures,
  getProduct,
  getSettings,
  recordLoginFailure,
  saveProduct,
  saveSettings,
  tooManyLoginFailures,
  updateOrderStatus,
} from "@/lib/db";
import {
  isStatus,
  isValidCurrency,
  type Availability,
  type FaqItem,
  type ProductContent,
  type StoreSettings,
} from "@/lib/content";

export type FormState = { ok?: boolean; message?: string; errors?: Record<string, string> };

const s = (fd: FormData, k: string, max = 2000) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};

function num(fd: FormData, k: string, errors: Record<string, string>, opts: { min?: number; max?: number; int?: boolean } = {}) {
  const raw = s(fd, k, 30).replace(",", ".");
  if (raw === "") return 0;
  const n = Number(raw);
  const min = opts.min ?? 0;
  const max = opts.max ?? 10_000_000;
  if (!Number.isFinite(n) || n < min || n > max || (opts.int && !Number.isInteger(n))) {
    errors[k] = `Enter a ${opts.int ? "whole " : ""}number between ${min} and ${max}.`;
    return 0;
  }
  return Math.round(n * 100) / 100;
}

const lines = (v: string, maxItems = 20) =>
  v
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((l) => l.slice(0, 200));

/* ------------------------------- auth ---------------------------------- */

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const problem = authConfigProblem();
  if (problem) return { message: `Admin sign-in is not configured: ${problem}` };

  const key = await clientKey();
  if (await tooManyLoginFailures(key)) {
    return { message: "Too many failed attempts. Wait 15 minutes and try again." };
  }
  const password = typeof fd.get("password") === "string" ? String(fd.get("password")) : "";
  if (!password || password.length > 200 || !verifyPassword(password)) {
    await recordLoginFailure(key);
    return { message: "That password is not correct." };
  }
  await clearLoginFailures(key);
  await startSession();
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

/* ------------------------------- orders -------------------------------- */

export async function setOrderStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const status = fd.get("status");
  if (!Number.isInteger(id) || id < 1 || !isStatus(status)) return { message: "Invalid status update." };
  await updateOrderStatus(id, status, s(fd, "adminNote", 1000));
  revalidatePath("/admin");
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true, message: "Order updated." };
}

/* ------------------------------- product ------------------------------- */

export async function updateProduct(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const errors: Record<string, string> = {};
  const current = await getProduct();

  const faqs: FaqItem[] = s(fd, "faqs", 8000)
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))
    .filter((b) => b.length >= 2)
    .slice(0, 15)
    .map(([q, ...a]) => ({ q: q.slice(0, 200), a: a.join(" ").slice(0, 800) }));

  const availability = s(fd, "availability") as Availability;
  const next: ProductContent = {
    name: s(fd, "name", 120) || current.name,
    modelNumber: s(fd, "modelNumber", 40),
    headline: s(fd, "headline", 120) || current.headline,
    subheadline: s(fd, "subheadline", 300),
    keyBenefit: s(fd, "keyBenefit", 300),
    price: num(fd, "price", errors),
    compareAtPrice: num(fd, "compareAtPrice", errors),
    availability: availability === "sold_out" ? "sold_out" : "in_stock",
    maxPerOrder: num(fd, "maxPerOrder", errors, { min: 1, max: 50, int: true }) || 1,
    colors: current.colors.map((c) => ({
      ...c,
      label: s(fd, `color_${c.key}_label`, 40) || c.label,
      available: fd.get(`color_${c.key}_available`) === "on",
    })),
    story: s(fd, "story", 1200),
    benefits: lines(s(fd, "benefits", 4000)),
    functions: lines(s(fd, "functions", 4000)),
    uses: lines(s(fd, "uses", 2000)),
    included: lines(s(fd, "included", 4000)),
    faqs,
  };
  if (next.compareAtPrice && next.compareAtPrice <= next.price) {
    errors.compareAtPrice = "The old price must be higher than the price, or 0 to hide it.";
  }
  if (Object.keys(errors).length) return { message: "Fix the highlighted fields.", errors };

  await saveProduct(next);
  revalidatePath("/", "layout");
  return { ok: true, message: "Product saved. The store page is updated." };
}

/* ------------------------------- settings ------------------------------ */

export async function updateSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const errors: Record<string, string> = {};
  const current = await getSettings();

  const currencyCode = s(fd, "currencyCode", 3).toUpperCase();
  if (currencyCode && !isValidCurrency(currencyCode)) errors.currencyCode = "Use a 3-letter currency code such as EGP, SAR, AED.";

  const email = s(fd, "supportEmail", 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.supportEmail = "Enter a valid email or leave it empty.";

  const phone = s(fd, "supportPhone", 30);
  if (phone && !/^\+?[\d\s()-]{6,24}$/.test(phone)) errors.supportPhone = "Use digits, spaces, + and - only.";

  const whatsapp = s(fd, "whatsappNumber", 30);
  if (whatsapp && !/^\+?[\d\s()-]{6,24}$/.test(whatsapp)) errors.whatsappNumber = "Use the full international number, digits only.";

  const accent = s(fd, "accentColor", 7);
  if (accent && !/^#[0-9a-fA-F]{6}$/.test(accent)) errors.accentColor = "Use a hex color like #f26722.";

  const next: StoreSettings = {
    storeName: s(fd, "storeName", 60) || current.storeName,
    tagline: s(fd, "tagline", 120),
    supportPhone: phone,
    whatsappNumber: whatsapp,
    supportEmail: email,
    supportHours: s(fd, "supportHours", 120),
    businessAddress: s(fd, "businessAddress", 300),
    currencyCode,
    deliveryFee: num(fd, "deliveryFee", errors),
    freeDeliveryFrom: num(fd, "freeDeliveryFrom", errors),
    serviceArea: s(fd, "serviceArea", 300),
    deliveryEstimate: s(fd, "deliveryEstimate", 120),
    returnsPolicy: s(fd, "returnsPolicy", 1500),
    privacyNote: s(fd, "privacyNote", 600) || current.privacyNote,
    announcement: s(fd, "announcement", 160),
    accentColor: accent || current.accentColor,
  };
  if (Object.keys(errors).length) return { message: "Fix the highlighted fields.", errors };

  await saveSettings(next);
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved. The store page is updated." };
}
