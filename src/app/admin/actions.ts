"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  authConfigProblem,
  clientKey,
  endSession,
  endAllSessions,
  requireAdmin,
  startSession,
  verifyPassword,
} from "@/lib/auth";
import {
  countLiveVisitors,
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
  saveOffers,
  saveSettings,
  tooManyLoginFailures,
  updateOrderStatus,
  getRack,
  saveRack,
  saveBundle,
} from "@/lib/db";
import {
  cleanOffers,
  isStatus,
  isValidCurrency,
  type Availability,
  type FaqItem,
  type ProductContent,
  type StoreSettings,
  formatMoney,
  type RackContent,
  type BundleContent,
} from "@/lib/content";
import { notifyAdmins, vapidPublicKey } from "@/lib/push";

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
  const bot = typeof fd.get("username_hp") === "string" && String(fd.get("username_hp")) !== "";
  if (bot || !password || password.length > 200 || !verifyPassword(password)) {
    await recordLoginFailure(key);
    // slow every wrong guess down a little
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
    return { message: "كلمة المرور غير صحيحة." };
  }
  await clearLoginFailures(key);
  await startSession();
  redirect("/admin?welcome=1");
}

export async function logoutEverywhere() {
  await requireAdmin();
  await endAllSessions();
  redirect("/admin/login");
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

export async function updateRack(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const errors: Record<string, string> = {};
  const current = await getRack();
  const availability = s(fd, "availability") as Availability;
  const next: RackContent = {
    enabled: fd.get("enabled") === "on",
    name: s(fd, "name", 120) || current.name,
    whatsappTitle: s(fd, "whatsappTitle", 120) || current.whatsappTitle,
    price: num(fd, "price", errors),
    includesDelivery: fd.get("includesDelivery") === "on",
    badge: s(fd, "badge", 60),
    availability: availability === "sold_out" ? "sold_out" : "in_stock",
    maxPerOrder: num(fd, "maxPerOrder", errors, { min: 1, max: 50, int: true }) || 1,
    headline: s(fd, "headline", 200),
    intro: s(fd, "intro", 600),
    featuresTitle: s(fd, "featuresTitle", 80),
    features: lines(s(fd, "features", 3000)),
    outro: s(fd, "outro", 300),
  };
  if (Object.keys(errors).length) return { message: "صحّح الحقول المحددة باللون الأحمر.", errors };
  await saveRack(next);
  revalidatePath("/", "layout");
  return { ok: true, message: "تم حفظ المنشر وتحديث صفحة المتجر." };
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
    showWhatsappButton: fd.get("showWhatsappButton") === "on",
    whatsappCheckout: fd.get("whatsappCheckout") === "on",
    westBankEnabled: fd.get("westBankEnabled") === "on",
    priceIncludesDelivery: fd.get("priceIncludesDelivery") === "on",
    displayPrice: num(fd, "displayPrice", errors),
    priceLabel: s(fd, "priceLabel", 80),
    showOfferDiscount: false,
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
export async function liveVisitors(): Promise<{ total: number; ordering: number }> {
  await requireAdmin();
  try {
    return await countLiveVisitors();
  } catch {
    return { total: 0, ordering: 0 };
  }
}

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

export async function updateOffers(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  let parsed: unknown;
  try {
    parsed = JSON.parse(s(fd, "offers", 20000) || "[]");
  } catch {
    return { ok: false, message: "تعذّر قراءة العروض. حدّث الصفحة وحاول مرة أخرى." };
  }
  const offers = cleanOffers(parsed);
  const bad = offers.findIndex((o) => o.active && (!o.title || o.price <= 0));
  if (bad >= 0) return { ok: false, message: `العرض رقم ${bad + 1}: اكتب اسم العرض وسعره قبل تفعيله.` };
  try {
    await saveOffers(offers);
  } catch {
    return { ok: false, message: "تعذّر الحفظ الآن. حاول مرة أخرى بعد قليل." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: offers.some((o) => o.active) ? "تم حفظ العروض وهي تظهر الآن في المتجر." : "تم الحفظ. لا يوجد عرض مفعّل حالياً." };
}

/** Admin → Settings: send a test notification to every device with alerts on. */
export async function sendTestPush(): Promise<string> {
  await requireAdmin();
  const r = await notifyAdmins({
    title: "✅ الإشعارات تعمل",
    body: "هكذا سيصلك تنبيه كل طلب جديد.",
    url: "/admin",
    tag: "test",
  });
  if (!r.devices) return "لا يوجد جهاز مفعّل. افتح التطبيق من الشاشة الرئيسية واضغط زر الجرس 🔔 ثم اسمح بالإشعارات.";
  if (r.sent) return `تم الإرسال إلى ${r.sent} ${r.sent === 1 ? "جهاز" : "أجهزة"}.${r.failed ? ` تعذّر الإرسال إلى ${r.failed}.` : ""}`;
  if (r.removed) return "انتهت صلاحية تفعيل الإشعارات على جهازك. اضغط زر الجرس 🔔 مرة أخرى لتفعيلها.";
  return "تعذّر إرسال الإشعار الآن. حاول مرة أخرى بعد قليل.";
}

/** Admin → Offers: the rack + salad maker bundle. */
export async function updateBundle(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const errors: Record<string, string> = {};
  const endsAt = s(fd, "endsAt", 10);
  const next: BundleContent = {
    active: fd.get("active") === "on",
    title: s(fd, "title", 80),
    price: num(fd, "price", errors),
    includesDelivery: fd.get("includesDelivery") === "on",
    badge: s(fd, "badge", 30),
    endsAt: /^\d{4}-\d{2}-\d{2}$/.test(endsAt) ? endsAt : "",
  };
  if (next.active && !next.title) errors.title = "اكتب اسم العرض.";
  if (next.active && next.price <= 0) errors.price = "اكتب سعر العرض.";
  if (Object.keys(errors).length) return { message: "صحّح الحقول المحددة باللون الأحمر.", errors };
  try {
    await saveBundle(next);
  } catch {
    return { ok: false, message: "تعذّر الحفظ الآن. حاول مرة أخرى بعد قليل." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: next.active ? "تم حفظ عرض المنشر + ماكنة السلطة وهو يظهر في المتجر." : "تم الحفظ. العرض متوقف." };
}
