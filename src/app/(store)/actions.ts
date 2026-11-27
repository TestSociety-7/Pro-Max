"use server";

import { headers } from "next/headers";
import { createOrder, getBundle, getOffers, getProduct, getRack, getSettings } from "@/lib/db";
import { notifyAdmins } from "@/lib/push";
import { after } from "next/server";
import { bundleLive, DELIVERY_ZONES, deliveryFeeCents, formatMoney, isZone, liveOffers, orderingOpen, rackOrderable, rackSubtotalCents, toCents, type RackContent, type StoreSettings } from "@/lib/content";
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

function whatsappOrderLink(number: string, lines: (string | null)[]): string {
  const digits = number.replace(/[^\d]/g, "");
  if (digits.length < 8) return "";
  const text = lines.filter((l): l is string => l !== null).join("\n");
  // api.whatsapp.com keeps emoji intact; the wa.me redirect turns them into "�" on some phones
  return `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(text)}`;
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

  let product, settings, offers, rack, bundle;
  try {
    [product, settings, offers, rack, bundle] = await Promise.all([getProduct(), getSettings(), getOffers(), getRack(), getBundle()]);
  } catch (err) {
    console.error("placeOrder: load failed", err);
    return { status: "error", message: "الخدمة غير متاحة حالياً. حاول بعد قليل.", values };
  }

  if (str(fd, "item") === "rack") return placeRackOrder(input, values, idempotencyKey, rack, settings);

  if (!orderingOpen(product, settings)) {
    return { status: "error", message: "الطلب غير متاح حالياً. تواصل معنا للمساعدة.", values };
  }

  const availableColors = product.colors.filter((c) => c.available);
  if (str(fd, "item") === "bundle") {
    if (!rackOrderable(rack, settings) || !bundleLive(bundle)) {
      return { status: "error", message: "هذا العرض لم يعد متاحاً. اختر من جديد.", values };
    }
    const errs = validateOrder({ ...input, quantity: 1 }, { maxPerOrder: 1, colors: availableColors.map((c) => c.key) });
    if (Object.keys(errs).length) return { status: "error", message: "يرجى تصحيح الحقول المشار إليها.", fieldErrors: errs, values };
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
    if (throttled(ip)) return { status: "error", message: "طلبات كثيرة خلال وقت قصير. حاول بعد دقائق أو اتصل بنا.", values };
    const zone = settings.westBankEnabled && isZone(input.zone) ? input.zone : "inside";
    const zoneLabel = DELIVERY_ZONES.find((z) => z.key === zone)!.label;
    const colorLabel = availableColors.find((c) => c.key === input.color)!.label;
    const subtotal = toCents(bundle.price);
    const fee = bundle.includesDelivery ? 0 : deliveryFeeCents(settings, subtotal, zone);
    try {
      const { order, duplicate } = await createOrder({
        idempotencyKey,
        customerName: input.name.trim(),
        phone: cleanPhone(input.phone),
        address: input.address.trim(),
        area: [zoneLabel, input.area.trim()].filter(Boolean).join(" · "),
        note: input.note.trim(),
        color: colorLabel,
        quantity: 1,
        unitPriceCents: subtotal,
        deliveryFeeCents: fee,
        totalCents: subtotal + fee,
        currency: settings.currencyCode,
        productName: `${bundle.title} · ${rack.name} + ${product.name}`,
      });
      if (!duplicate) {
        after(() =>
          notifyAdmins({
            title: `🛒 طلب جديد ${order.ref} · ${formatMoney(order.totalCents, order.currency)}`,
            body: [`${order.customerName} · ${order.phone}`, `${rack.name} + ماكنة السلطة ${order.color}`, order.area].join("\n"),
            url: `/admin/orders/${order.id}`,
            tag: order.ref,
          }),
        );
      }
      return {
        status: "success",
        ref: order.ref,
        total: formatMoney(order.totalCents, order.currency),
        quantity: 1,
        color: order.color,
        name: order.customerName,
        phone: order.phone,
        // same format as the single products, both devices on the first line
        whatsappUrl: !settings.whatsappCheckout ? "" : whatsappOrderLink(settings.whatsappNumber, [
          `${rack.whatsappTitle} + ماكنه سلطه ${order.color}`,
          `👤 الاسم: ${order.customerName}`,
          `📞 الهاتف: ${order.phone}`,
          `🏙 المدينة / البلدة: ${input.area.trim()}`,
          `📍 العنوان: ${order.address}`,
          `السعر : ${order.totalCents / 100} شامل التوصيل`,
          zoneLabel,
        ]),
      };
    } catch (err) {
      console.error("placeOrder: bundle insert failed", err);
      return { status: "error", message: "تعذّر حفظ الطلب. حاول مرة أخرى بعد قليل.", values };
    }
  }

  // An active offer always applies: the one the customer picked, or the first one.
  const live = liveOffers(offers);
  const offerId = str(fd, "offer") || live[0]?.id || "";
  const offer = offerId ? live.find((o) => o.id === offerId) : undefined;
  if (offerId && !offer) {
    return { status: "error", message: "هذا العرض لم يعد متاحاً. اختر من جديد.", values };
  }
  if (offer) input.quantity = offer.quantity;
  const fieldErrors = validateOrder(input, {
    maxPerOrder: offer ? offer.quantity : product.maxPerOrder,
    colors: availableColors.map((c) => c.key),
  });
  // an offer picks a color for each device
  const unitColors = [input.color];
  if (offer) {
    for (let i = 2; i <= offer.quantity; i++) {
      const c = str(fd, `color_${i}`) || input.color;
      if (!availableColors.some((a) => a.key === c)) fieldErrors.color = "اختر لون كل قطعة.";
      unitColors.push(c);
    }
  }
  if (Object.keys(fieldErrors).length) {
    return { status: "error", message: "يرجى تصحيح الحقول المشار إليها.", fieldErrors, values };
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (throttled(ip)) {
    return { status: "error", message: "طلبات كثيرة خلال وقت قصير. حاول بعد دقائق أو اتصل بنا.", values };
  }

  const zone = settings.westBankEnabled && isZone(input.zone) ? input.zone : "inside";
  const zoneLabel = DELIVERY_ZONES.find((z) => z.key === zone)!.label;
  const label = (k: string) => availableColors.find((c) => c.key === k)!.label;
  let unit: number, subtotal: number, fee: number, colorLabel: string;
  if (offer) {
    subtotal = toCents(offer.price);
    unit = Math.round(subtotal / offer.quantity);
    fee = offer.includesDelivery ? 0 : deliveryFeeCents(settings, subtotal, zone);
    const counts = new Map<string, number>();
    for (const c of unitColors) counts.set(c, (counts.get(c) ?? 0) + 1);
    colorLabel = [...counts].map(([k, n]) => (counts.size === 1 ? label(k) : `${n} ${label(k)}`)).join(" + ");
  } else {
    unit = toCents(product.price);
    subtotal = unit * input.quantity;
    fee = deliveryFeeCents(settings, subtotal, zone);
    colorLabel = label(input.color);
  }

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
      productName: offer ? `${product.name} · ${offer.title}` : product.name,
    });
    if (!duplicate) {
      // send after the customer gets their confirmation, so ordering never waits on push
      after(() =>
        notifyAdmins({
          title: `🛒 طلب جديد ${order.ref} · ${formatMoney(order.totalCents, order.currency)}`,
          body: [
            `${order.customerName} · ${order.phone}`,
            `${offer ? offer.title + " · " : ""}${order.quantity} × ${order.color}`,
            order.area,
          ].join("\n"),
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
      // Short format the owner asked for, e.g. "ماكنه سلطه بيج" then name / phone / town / address.
      whatsappUrl: !settings.whatsappCheckout ? "" : whatsappOrderLink(settings.whatsappNumber, [
        // EXACT format the owner asked for (2026-11-23 and again 2026-11-26) — do not add lines
        `ماكنه سلطه ${order.color}`,
        `👤 الاسم: ${order.customerName}`,
        `📞 الهاتف: ${order.phone}`,
        `🏙 المدينة / البلدة: ${input.area.trim()}`,
        `📍 العنوان: ${order.address}`,
        `السعر : ${order.totalCents / 100} شامل التوصيل`,
        zoneLabel,
      ]),
    };
  } catch (err) {
    console.error("placeOrder: insert failed", err);
    return { status: "error", message: "تعذّر حفظ الطلب. حاول مرة أخرى بعد قليل.", values };
  }
}

/** Order for the electric drying rack: one model, no colors, no offers. */
async function placeRackOrder(
  input: OrderInput,
  values: Partial<Record<keyof OrderInput, string>>,
  idempotencyKey: string,
  rack: RackContent,
  settings: StoreSettings,
): Promise<OrderState> {
  if (!rackOrderable(rack, settings)) {
    return { status: "error", message: "طلب المنشر غير متاح حالياً. تواصل معنا للمساعدة.", values };
  }
  const fieldErrors = validateOrder({ ...input, color: "rack" }, { maxPerOrder: rack.maxPerOrder, colors: ["rack"] });
  if (Object.keys(fieldErrors).length) {
    return { status: "error", message: "يرجى تصحيح الحقول المشار إليها.", fieldErrors, values };
  }
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (throttled(ip)) {
    return { status: "error", message: "طلبات كثيرة خلال وقت قصير. حاول بعد دقائق أو اتصل بنا.", values };
  }

  const zone = settings.westBankEnabled && isZone(input.zone) ? input.zone : "inside";
  const zoneLabel = DELIVERY_ZONES.find((z) => z.key === zone)!.label;
  const unit = toCents(rack.price);
  // delivery is inside the price, so it is charged once: extra racks cost less
  const subtotal = rackSubtotalCents(rack, settings, input.quantity);
  const fee = rack.includesDelivery ? 0 : deliveryFeeCents(settings, subtotal, zone);
  try {
    const { order, duplicate } = await createOrder({
      idempotencyKey,
      customerName: input.name.trim(),
      phone: cleanPhone(input.phone),
      address: input.address.trim(),
      area: [zoneLabel, input.area.trim()].filter(Boolean).join(" · "),
      note: input.note.trim(),
      color: "—",
      quantity: input.quantity,
      unitPriceCents: unit,
      deliveryFeeCents: fee,
      totalCents: subtotal + fee,
      currency: settings.currencyCode,
      productName: rack.name,
    });
    if (!duplicate) {
      after(() =>
        notifyAdmins({
          title: `🛒 طلب جديد ${order.ref} · ${formatMoney(order.totalCents, order.currency)}`,
          body: [`${order.customerName} · ${order.phone}`, `${order.quantity} × ${rack.name}`, order.area].join("\n"),
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
      // same five lines as the salad maker, with the rack's name on the first line
      whatsappUrl: !settings.whatsappCheckout ? "" : whatsappOrderLink(settings.whatsappNumber, [
        input.quantity > 1 ? `${rack.whatsappTitle} × ${input.quantity}` : rack.whatsappTitle,
        `👤 الاسم: ${order.customerName}`,
        `📞 الهاتف: ${order.phone}`,
        `🏙 المدينة / البلدة: ${input.area.trim()}`,
        `📍 العنوان: ${order.address}`,
        `السعر : ${order.totalCents / 100} شامل التوصيل`,
        zoneLabel,
      ]),
    };
  } catch (err) {
    console.error("placeOrder: rack insert failed", err);
    return { status: "error", message: "تعذّر حفظ الطلب. حاول مرة أخرى بعد قليل.", values };
  }
}
