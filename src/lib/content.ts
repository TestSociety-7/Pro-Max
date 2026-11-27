// Shapes and defaults for the owner-editable content (Admin → Product / Store Settings).
// Default product copy is taken only from the owner's own box and poster artwork.
// Business facts the owner has not given yet (price, currency, delivery, returns,
// phone) start empty: the storefront hides them or shows "to be confirmed".

export type FaqItem = { q: string; a: string };

export type StoreSettings = {
  storeName: string;
  tagline: string;
  supportPhone: string;
  whatsappNumber: string;
  supportHours: string;
  currencyCode: string; // ISO 4217, e.g. "EGP", "SAR", "AED", "MAD", "IQD"
  deliveryFee: number; // major units, delivery inside (الداخل)
  deliveryFeeWestBank: number; // major units, delivery to the West Bank (الضفة)
  freeDeliveryFrom: number; // order subtotal for free delivery; 0 = never
  serviceArea: string;
  deliveryEstimate: string;
  returnsPolicy: string;
  announcement: string;
  accentColor: string; // hex
  showWhatsappButton: boolean; // floating WhatsApp contact button on the store
  whatsappCheckout: boolean; // after an order, open WhatsApp with the order message
  westBankEnabled: boolean; // show the الضفة delivery choice at checkout
  priceIncludesDelivery: boolean; // product price already covers delivery inside (الداخل)
  displayPrice: number; // price shown in the hero and compared against offers; 0 = product price
  priceLabel: string; // small text above the hero price
  showOfferDiscount: boolean; // offer cards show "خصم X" and the struck regular price
};

export type Availability = "in_stock" | "sold_out";

export type ColorOption = {
  key: "black" | "beige";
  label: string;
  available: boolean;
};

export type ProductContent = {
  name: string;
  modelNumber: string;
  headline: string;
  subheadline: string;
  keyBenefit: string;
  price: number; // major units; 0 = not set yet → ordering closed
  compareAtPrice: number; // 0 = none
  availability: Availability;
  maxPerOrder: number;
  colors: ColorOption[];
  story: string;
  benefits: string[];
  functions: string[];
  uses: string[];
  included: string[];
  faqs: FaqItem[];
};

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Pro Max",
  tagline: "قطاعة السلطات 7 في 1",
  supportPhone: "",
  whatsappNumber: "",
  supportHours: "",
  currencyCode: "ILS",
  deliveryFee: 50,
  deliveryFeeWestBank: 70,
  freeDeliveryFrom: 0,
  serviceArea: "",
  deliveryEstimate: "",
  returnsPolicy: "",
  announcement: "",
  accentColor: "#f26722",
  showWhatsappButton: true,
  whatsappCheckout: true,
  westBankEnabled: true,
  priceIncludesDelivery: true,
  displayPrice: 0,
  priceLabel: "السعر الطبيعي · سعر القطعة مع التوصيل",
  showOfferDiscount: false,
};

export const DEFAULT_PRODUCT: ProductContent = {
  name: "قطاعة السلطات Pro Max",
  modelNumber: "PR-067",
  headline: "قطاعة السلطات 7 في 1",
  subheadline: "لتقطيع البصل والخيار والجزر والملفوف والسلطة العربية.",
  keyBenefit: "مناسبة لجميع أنواع السلطات، ومثالية للاستخدام المنزلي.",
  price: 0,
  compareAtPrice: 0,
  availability: "in_stock",
  maxPerOrder: 5,
  colors: [
    { key: "black", label: "أسود", available: true },
    { key: "beige", label: "بيج", available: true },
  ],
  story:
    "جهاز واحد بأقراص قابلة للتبديل: شرائح، بشر، جوليان، تقطيع مموّج وفرم. ركّب القرص المناسب، أدخل الخضار من الفتحة الواسعة، ودع Pro Max يتولّى التقطيع.",
  benefits: [
    "ملحقات متعددة الوظائف",
    "علبة عملية لحفظ الشفرات",
    "قفل أمان للحماية",
    "فتحة تغذية واسعة",
    "أرجل مطاطية مانعة للانزلاق",
    "تقطيع وفرم بكفاءة",
  ],
  functions: [
    "تقطيع شرائح",
    "بشر خشن / ناعم",
    "برش",
    "جوليان خشن / ناعم",
    "شرائح مموّجة",
    "فرم",
  ],
  uses: ["البصل", "الخيار", "الجزر", "الملفوف", "السلطة العربية", "جميع أنواع السلطات"],
  included: [],
  faqs: [
    {
      q: "كيف أدفع ثمن الطلب؟",
      a: "الدفع نقداً عند الاستلام. لا نطلب أي بيانات بطاقة على الموقع.",
    },
    {
      q: "ما الألوان المتوفرة؟",
      a: "لونان: الأسود والبيج. اختر اللون الذي يناسب مطبخك في نموذج الطلب.",
    },
    {
      q: "هل ستتواصلون معي قبل الشحن؟",
      a: "نعم، سنتصل بك على الرقم الذي تكتبه لتأكيد الطلب والعنوان قبل الشحن.",
    },
  ],
};

export const ORDER_STATUSES = ["new", "confirmed", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "جديد",
  confirmed: "مؤكَّد",
  shipped: "قيد الشحن",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
};

export function isStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);
}

/** Merge stored JSON over defaults so new fields never crash old rows. */
export function withDefaults<T extends object>(defaults: T, stored: unknown): T {
  if (!stored || typeof stored !== "object") return structuredClone(defaults);
  const out = structuredClone(defaults) as Record<string, unknown>;
  for (const key of Object.keys(defaults)) {
    const v = (stored as Record<string, unknown>)[key];
    const d = (defaults as Record<string, unknown>)[key];
    if (v === undefined || v === null) continue;
    if (Array.isArray(d) ? Array.isArray(v) : typeof v === typeof d) out[key] = v;
  }
  return out as T;
}

export function toCents(major: number): number {
  return Math.round(major * 100);
}

export function isValidCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: code });
    return true;
  } catch {
    return false;
  }
}

export function formatMoney(cents: number, currency: string, locale = "ar-u-nu-latn"): string {
  const amount = cents / 100;
  if (!isValidCurrency(currency)) return amount.toFixed(amount % 1 === 0 ? 0 : 2);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const DELIVERY_ZONES = [
  { key: "inside", label: "الداخل" },
  { key: "westbank", label: "الضفة" },
] as const;
export type DeliveryZone = (typeof DELIVERY_ZONES)[number]["key"];
export function isZone(v: unknown): v is DeliveryZone {
  return DELIVERY_ZONES.some((z) => z.key === v);
}
export function zoneFee(settings: StoreSettings, zone: DeliveryZone): number {
  const fee = toCents(zone === "westbank" ? settings.deliveryFeeWestBank : settings.deliveryFee);
  // when the price already includes delivery inside, only the difference for other areas is added
  return settings.priceIncludesDelivery ? Math.max(0, fee - toCents(settings.deliveryFee)) : fee;
}

/** Delivery fee in cents for a zone and subtotal (cents). */
export function deliveryFeeCents(settings: StoreSettings, subtotalCents: number, zone: DeliveryZone): number {
  const fee = zoneFee(settings, zone);
  const freeFrom = toCents(settings.freeDeliveryFrom);
  if (freeFrom > 0 && subtotalCents >= freeFrom) return 0;
  return Math.max(0, fee);
}

/** Ordering is open only once the owner has set a price and currency and the product is in stock. */
export function orderingOpen(p: ProductContent, s: StoreSettings): boolean {
  return (
    p.availability === "in_stock" &&
    p.price > 0 &&
    isValidCurrency(s.currencyCode) &&
    p.colors.some((c) => c.available)
  );
}

/* ---------------------------- offers / bundles ---------------------------- */

export type Offer = {
  id: string;
  title: string; // e.g. "عرض القطعتين"
  quantity: number; // devices in the bundle
  price: number; // major units, the whole bundle
  includesDelivery: boolean; // true = no delivery fee on top
  badge: string; // short ribbon text, e.g. "الأكثر طلباً"
  active: boolean;
  theme: "standard" | "blackfriday";
  endsAt: string; // "" or YYYY-MM-DD: shows a countdown and hides the offer after that day
};

export const MAX_OFFERS = 6;

export const DEFAULT_OFFERS: Offer[] = [
  { id: "duo", title: "عرض القطعتين", quantity: 2, price: 270, includesDelivery: true, badge: "عرض خاص", active: true, theme: "standard", endsAt: "" },
  {
    id: "black-friday",
    title: "عرض الجمعة السوداء",
    quantity: 2,
    price: 250,
    includesDelivery: true,
    badge: "Black Friday",
    active: false,
    theme: "blackfriday",
    endsAt: "2026-11-30",
  },
];

/** Clean whatever is stored (or posted) into a safe list of offers. */
export function cleanOffers(raw: unknown): Offer[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Offer[] = [];
  for (const r of raw.slice(0, MAX_OFFERS)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    let id = typeof o.id === "string" && /^[a-z0-9-]{1,24}$/.test(o.id) ? o.id : "";
    if (!id || seen.has(id)) id = `o${Date.now().toString(36)}${out.length}`;
    seen.add(id);
    const quantity = Math.round(Number(o.quantity));
    const price = Math.round(Number(o.price) * 100) / 100;
    out.push({
      id,
      title: String(o.title ?? "").trim().slice(0, 60),
      quantity: Number.isFinite(quantity) ? Math.min(Math.max(quantity, 1), 10) : 1,
      price: Number.isFinite(price) && price > 0 ? Math.min(price, 1_000_000) : 0,
      includesDelivery: o.includesDelivery === true,
      badge: String(o.badge ?? "").trim().slice(0, 30),
      active: o.active === true,
      theme: o.theme === "blackfriday" ? "blackfriday" : "standard",
      endsAt: typeof o.endsAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.endsAt) ? o.endsAt : "",
    });
  }
  return out;
}

/** Offers a customer can actually pick. */
export function liveOffers(offers: Offer[], now = Date.now()): Offer[] {
  return offers.filter((o) => o.active && o.price > 0 && o.title && (!o.endsAt || now < offerEndMs(o.endsAt)));
}

/** End of the offer's last day, Palestine/Israel time (UTC+2/+3; +2 keeps it inclusive). */
export function offerEndMs(endsAt: string): number {
  return Date.parse(`${endsAt}T23:59:59+02:00`);
}

/* --------------------------- second product ---------------------------- */

/** The electric clothes-drying rack, sold next to the salad maker. Copy is the owner's own text. */
export type RackContent = {
  enabled: boolean; // shown on the store
  name: string;
  whatsappTitle: string; // first line of the WhatsApp order message
  price: number; // major units; 0 = not set yet → section shows, ordering closed
  includesDelivery: boolean; // price already covers delivery to every area
  badge: string; // small tag over the price, e.g. "عرض لفترة محدودة"; empty = hidden
  availability: Availability;
  maxPerOrder: number;
  headline: string;
  intro: string;
  featuresTitle: string;
  features: string[];
  outro: string;
};

export const DEFAULT_RACK: RackContent = {
  enabled: true,
  name: "منشر الغسيل الكهربائي",
  whatsappTitle: "منشر الغسيل الكهربائي",
  price: 350,
  includesDelivery: true,
  badge: "عرض لفترة محدودة",
  availability: "in_stock",
  maxPerOrder: 3,
  headline: "🔥 ودّع نشر الغسيل التقليدي مع منشر الغسيل الكهربائي! 🔥",
  intro: "وفّر وقتك وجهدك مع الحل العملي لتجفيف الملابس، بقوة 230 واط واستهلاك موفّر للكهرباء.",
  featuresTitle: "المميزات:",
  features: [
    "⚡ قدرة تشغيل 230 واط موفّرة للكهرباء.",
    "👕 يتحمّل من 15 إلى 20 كيلو من الملابس.",
    "💧 مقاوم للماء.",
    "🛠 هيكل ألمنيوم متين.",
    "🌡 غطاء حراري يساعد على زيادة سرعة التجفيف.",
    "🌧 مناسب للاستخدام داخل وخارج المنزل، ومصمم لتحمّل المطر.",
  ],
  outro: "✨ وداعاً لانتظار الغسيل لساعات طويلة!",
};

/** Price of each rack after the first: when the price includes delivery, delivery (inside fee) is charged once per order. */
export function rackExtraUnitCents(r: RackContent, s: StoreSettings): number {
  const unit = toCents(r.price);
  return r.includesDelivery ? Math.max(0, unit - toCents(s.deliveryFee)) : unit;
}

/** Racks subtotal: the first at the full price, each extra one at rackExtraUnitCents. */
export function rackSubtotalCents(r: RackContent, s: StoreSettings, qty: number): number {
  return toCents(r.price) + rackExtraUnitCents(r, s) * Math.max(0, qty - 1);
}

export function rackOrderable(r: RackContent, s: StoreSettings): boolean {
  return r.enabled && r.availability === "in_stock" && r.price > 0 && isValidCurrency(s.currencyCode);
}

/* ------------------------ bundle: rack + salad maker -------------------- */

/** One price for the drying rack and the salad maker together (Black Friday, 2026-11-27). */
export type BundleContent = {
  active: boolean;
  title: string;
  price: number; // major units, both devices together
  includesDelivery: boolean;
  badge: string;
  endsAt: string; // "" or YYYY-MM-DD
};

export const DEFAULT_BUNDLE: BundleContent = {
  active: true,
  title: "عرض الجمعة السوداء: المنشر + ماكنة السلطة",
  price: 600,
  includesDelivery: true,
  badge: "Black Friday",
  endsAt: "",
};

export function bundleLive(b: BundleContent, now = Date.now()): boolean {
  return b.active && b.price > 0 && !!b.title.trim() && (!b.endsAt || now < offerEndMs(b.endsAt));
}
