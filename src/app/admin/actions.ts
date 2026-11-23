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
  deletePushSub,
  deleteOrders,
  latestOrderId,
  ordersAfter,
  savePushSub,
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
  formatMoney,
} from "@/lib/content";
import { vapidPublicKey } from "@/lib/push";

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
    errors[k] = `أدخل رقماً ${opts.int ? "صحيحاً " : ""}بين ${min} و ${max}.`;
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
  if (problem) return { message: `تسجيل الدخول غير مُعدّ بعد: ${problem}` };

  const key = await clientKey();
  if (await tooManyLoginFailures(key)) {
    return { message: "محاولات خاطئة كثيرة. انتظر 15 دقيقة ثم حاول مجدداً." };
  }
  const password = typeof fd.get("password") === "string" ? String(fd.get("password")) : "";
  if (!password || password.length > 200 || !verifyPassword(password)) {
    await recordLoginFailure(key);
    return { message: "كلمة المرور غير صحيحة." };
  }
  await clearLoginFailures(key);
  await startSession();
  redirect("/admin?welcome=1");
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
  if (!Number.isInteger(id) || id < 1 || !isStatus(status)) return { message: "تحديث غير صالح." };
  await updateOrderStatus(id, status, s(fd, "adminNote", 1000));
  revalidatePath("/admin");
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true, message: "تم تحديث الطلب." };
}

export async function removeOrders(ids: number[]): Promise<{ ok: boolean }> {
  await requireAdmin();
  if (!Array.isArray(ids)) return { ok: false };
  await deleteOrders(ids.map(Number));
  revalidatePath("/admin");
  return { ok: true };
}

export async function removeOrderAndBack(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  if (Number.isInteger(id) && id > 0) await deleteOrders([id]);
  revalidatePath("/admin");
  redirect("/admin");
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
    errors.compareAtPrice = "السعر القديم يجب أن يكون أعلى من السعر الحالي، أو 0 لإخفائه.";
  }
  if (Object.keys(errors).length) return { message: "صحّح الحقول المحددة باللون الأحمر.", errors };

  await saveProduct(next);
  revalidatePath("/", "layout");
  return { ok: true, message: "تم حفظ المنتج وتحديث صفحة المتجر." };
}

/* ------------------------------- settings ------------------------------ */

export async function updateSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const errors: Record<string, string> = {};
  const current = await getSettings();

  const currencyCode = s(fd, "currencyCode", 3).toUpperCase();
  if (currencyCode && !isValidCurrency(currencyCode)) errors.currencyCode = "استخدم رمز عملة من 3 أحرف مثل ILS.";


  const phone = s(fd, "supportPhone", 30);
  if (phone && !/^\+?[\d\s()-]{6,24}$/.test(phone)) errors.supportPhone = "استخدم الأرقام والمسافات و + و - فقط.";

  const whatsapp = s(fd, "whatsappNumber", 30);
  if (whatsapp && !/^\+?[\d\s()-]{6,24}$/.test(whatsapp)) errors.whatsappNumber = "اكتب الرقم الدولي كاملاً، أرقام فقط.";

  const accent = s(fd, "accentColor", 7);
  if (accent && !/^#[0-9a-fA-F]{6}$/.test(accent)) errors.accentColor = "استخدم لوناً بصيغة hex مثل #f26722.";

  const next: StoreSettings = {
    storeName: s(fd, "storeName", 60) || current.storeName,
    tagline: s(fd, "tagline", 120),
    supportPhone: phone,
    whatsappNumber: whatsapp,
    supportHours: s(fd, "supportHours", 120),
    currencyCode,
    deliveryFee: num(fd, "deliveryFee", errors),
    deliveryFeeWestBank: num(fd, "deliveryFeeWestBank", errors),
    freeDeliveryFrom: num(fd, "freeDeliveryFrom", errors),
    serviceArea: s(fd, "serviceArea", 300),
    deliveryEstimate: s(fd, "deliveryEstimate", 120),
    returnsPolicy: s(fd, "returnsPolicy", 1500),
    announcement: s(fd, "announcement", 160),
    accentColor: accent || current.accentColor,
  };
  if (Object.keys(errors).length) return { message: "صحّح الحقول المحددة باللون الأحمر.", errors };

  await saveSettings(next);
  revalidatePath("/", "layout");
  return { ok: true, message: "تم حفظ الإعدادات وتحديث صفحة المتجر." };
}

/* ---------------------------- notifications ---------------------------- */

export async function getPushKey(): Promise<string> {
  await requireAdmin();
  return vapidPublicKey();
}

export async function subscribePush(sub: string): Promise<boolean> {
  await requireAdmin();
  let parsed: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  try {
    parsed = JSON.parse(sub);
  } catch {
    return false;
  }
  const ep = parsed.endpoint;
  if (typeof ep !== "string" || !/^https:\/\//.test(ep) || ep.length > 1000) return false;
  if (typeof parsed.keys?.p256dh !== "string" || typeof parsed.keys?.auth !== "string") return false;
  await savePushSub(ep, JSON.stringify({ endpoint: ep, keys: { p256dh: parsed.keys.p256dh, auth: parsed.keys.auth } }));
  return true;
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await requireAdmin();
  if (typeof endpoint === "string" && endpoint.length <= 1000) await deletePushSub(endpoint);
}

export type NewOrderAlert = { id: number; ref: string; name: string; summary: string };

/** Live alerts while the admin is open: orders created after `afterId`. Pass 0 to just get the current latest id. */
export async function checkNewOrders(afterId: number): Promise<{ latest: number; orders: NewOrderAlert[] }> {
  await requireAdmin();
  if (!Number.isInteger(afterId) || afterId < 1) return { latest: await latestOrderId(), orders: [] };
  const rows = await ordersAfter(afterId);
  return {
    latest: rows.length ? rows[rows.length - 1].id : afterId,
    orders: rows.map((o) => ({
      id: o.id,
      ref: o.ref,
      name: o.customerName,
      summary: `${o.quantity} × ${o.color} · ${formatMoney(o.totalCents, o.currency)}`,
    })),
  };
}
