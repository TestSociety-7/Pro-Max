"use server";

import { headers } from "next/headers";
import { createOrder, getProduct, getSettings } from "@/lib/db";
import { notifyAdmins } from "@/lib/push";
import { after } from "next/server";
import { DELIVERY_ZONES, deliveryFeeCents, formatMoney, isZone, orderingOpen, toCents } from "@/lib/content";
import { cleanPhone, normalizeDigits, validateOrder, type FieldErrors, type OrderInput } from "@/lib/validation";

export type OrderState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: FieldErrors; values?: Partial<Record<keyof OrderInput, string>> }
  | {
      status: "success";
      ref: string;
      total: string;
      quantity: number;
      color: string;
      name: string;
      phone: string;
      /** wa.me link with the order pre-written, to the store's WhatsApp number (empty if none is set). */
      whatsappUrl: string;
    };

// Light per-process throttle against scripted spam. Serverless instances do not
// share this, so treat it as a speed bump, not a guarantee.
const recent = new Map<string, number[]>();
function throttled(key: string): boolean {
  const now = Date.now();
  const list = (recent.get(key) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  recent.set(key, list);
  if (recent.size > 5000) recent.clear();
  return list.length > 8;
}

function whatsappOrderLink(number: string, lines: string[]): string {
  const digits = number.replace(/[^\d]/g, "");
  if (digits.length < 8) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.filter(Boolean).join("\n"))}`;
}

function str(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
}

export async function placeOrder(_prev: OrderState, fd: FormData): Promise<OrderState> {
  // Honeypot: real people never fill this hidden field.
  if (str(fd, "website")) return { status: "error", message: "تعذّر إرسال الطلب." };

  const idempotencyKey = str(fd, "idempotencyKey");
  if (!/^[A-Za-z0-9-]{16,64}$/.test(idempotencyKey)) {
    return { status: "error", message: "حدث خطأ في النموذج. حدّث الصفحة وحاول مرة أخرى." };
  }

  const values = {
    name: str(fd, "name"),
    phone: str(fd, "phone"),
    address: str(fd, "address"),
    area: str(fd, "area"),
    note: str(fd, "note"),
    color: str(fd, "color"),
    quantity: str(fd, "quantity"),
    zone: str(fd, "zone"),
  };

  const input: OrderInput = {
    ...values,
    quantity: Number(normalizeDigits(values.quantity)),
  };

  let product, settings;
  try {
    [product, settings] = await Promise.all([getProduct(), getSettings()]);
  } catch (err) {
    console.error("placeOrder: load failed", err);
    return { status: "error", message: "الخدمة غير متاحة حالياً. حاول بعد قليل.", values };
  }

  if (!orderingOpen(product, settings)) {
    return { status: "error", message: "الطلب غير متاح حالياً. تواصل معنا للمساعدة.", values };
  }

  const availableColors = product.colors.filter((c) => c.available);
  const fieldErrors = validateOrder(input, {
    maxPerOrder: product.maxPerOrder,
    colors: availableColors.map((c) => c.key),
  });
  if (Object.keys(fieldErrors).length) {
    return { status: "error", message: "يرجى تصحيح الحقول المشار إليها.", fieldErrors, values };
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (throttled(ip)) {
    return { status: "error", message: "طلبات كثيرة خلال وقت قصير. حاول بعد دقائق أو اتصل بنا.", values };
  }

  const unit = toCents(product.price);
  const subtotal = unit * input.quantity;
  const zone = isZone(input.zone) ? input.zone : "inside";
  const zoneLabel = DELIVERY_ZONES.find((z) => z.key === zone)!.label;
  const fee = deliveryFeeCents(settings, subtotal, zone);
  const colorLabel = availableColors.find((c) => c.key === input.color)!.label;

  try {
    const { order, duplicate } = await createOrder({
      idempotencyKey,
      customerName: input.name.trim(),
      phone: cleanPhone(input.phone),
      address: input.address.trim(),
      area: [zoneLabel, input.area.trim()].filter(Boolean).join(" · "),
      note: input.note.trim(),
      color: colorLabel,
      quantity: input.quantity,
      unitPriceCents: unit,
      deliveryFeeCents: fee,
      totalCents: subtotal + fee,
      currency: settings.currencyCode,
      productName: product.name,
    });
    if (!duplicate) {
      // send after the customer gets their confirmation, so ordering never waits on push
      after(() =>
        notifyAdmins({
        title: `طلب جديد ${order.ref}`,
        body: `${order.customerName} · ${order.quantity} × ${order.color} · ${formatMoney(order.totalCents, order.currency)}`,
        url: `/admin/orders/${order.id}`,
          tag: order.ref,
        }),
      );
    }
    return {
      status: "success",
      ref: order.ref,
      total: formatMoney(order.totalCents, order.currency),
      quantity: order.quantity,
      color: order.color,
      name: order.customerName,
      phone: order.phone,
      whatsappUrl: whatsappOrderLink(settings.whatsappNumber, [
        `طلب جديد ${order.ref}`,
        `الاسم: ${order.customerName}`,
        `الهاتف: ${order.phone}`,
        `المنتج: ${order.productName} × ${order.quantity} (${order.color})`,
        `التوصيل: ${order.area}`,
        `العنوان: ${order.address}`,
        order.note ? `ملاحظة: ${order.note}` : "",
        `الإجمالي عند الاستلام: ${formatMoney(order.totalCents, order.currency)}`,
      ]),
    };
  } catch (err) {
    console.error("placeOrder: insert failed", err);
    return { status: "error", message: "تعذّر حفظ الطلب. حاول مرة أخرى بعد قليل.", values };
  }
}
