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
  supportEmail: string;
  supportHours: string;
  businessAddress: string;
  currencyCode: string; // ISO 4217, e.g. "EGP", "SAR", "AED", "MAD", "IQD"
  deliveryFee: number; // major units
  freeDeliveryFrom: number; // order subtotal for free delivery; 0 = never
  serviceArea: string;
  deliveryEstimate: string;
  returnsPolicy: string;
  privacyNote: string;
  announcement: string;
  accentColor: string; // hex
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
  supportEmail: "",
  supportHours: "",
  businessAddress: "",
  currencyCode: "ILS",
  deliveryFee: 0,
  freeDeliveryFrom: 0,
  serviceArea: "",
  deliveryEstimate: "",
  returnsPolicy: "",
  privacyNote:
    "نستخدم اسمك ورقم هاتفك وعنوانك فقط لتأكيد طلبك وتوصيله والتواصل معك بخصوصه، ولا نشاركها لأي غرض آخر.",
  announcement: "",
  accentColor: "#f26722",
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

/** Delivery fee in cents for a given subtotal (cents). */
export function deliveryFeeCents(settings: StoreSettings, subtotalCents: number): number {
  const fee = toCents(settings.deliveryFee);
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
