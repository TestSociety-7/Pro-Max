// Shared order-form validation. Runs on the server (authoritative) and in the
// browser (for instant inline errors). Messages are Arabic because the
// storefront is Arabic.

export type OrderInput = {
  name: string;
  phone: string;
  address: string;
  area: string;
  note: string;
  color: string;
  quantity: number;
  zone: string;
};

export type FieldErrors = Partial<Record<keyof OrderInput, string>>;

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Convert Arabic-Indic / Persian digits to ASCII so phone numbers store consistently. */
export function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (d) => {
    const i = AR_DIGITS.indexOf(d);
    return String(i >= 0 ? i : FA_DIGITS.indexOf(d));
  });
}

export function cleanPhone(raw: string): string {
  return normalizeDigits(raw).replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

const ZONES = ["inside", "westbank"];

export function validateOrder(
  input: OrderInput,
  opts: { maxPerOrder: number; colors: string[] },
): FieldErrors {
  const e: FieldErrors = {};
  const name = input.name.trim();
  if (name.length < 2) e.name = "من فضلك اكتب اسمك.";
  else if (name.length > 80) e.name = "الاسم طويل جداً.";

  const digits = cleanPhone(input.phone).replace("+", "");
  if (!digits) e.phone = "من فضلك اكتب رقم هاتفك.";
  else if (digits.length < 8 || digits.length > 15) e.phone = "رقم الهاتف غير صحيح. تأكد من الأرقام.";

  const address = input.address.trim();
  if (address.length < 6) e.address = "من فضلك اكتب عنوان التوصيل بالتفصيل.";
  else if (address.length > 300) e.address = "العنوان طويل جداً.";

  if (input.area.trim().length > 80) e.area = "اسم المنطقة طويل جداً.";
  if (input.note.trim().length > 300) e.note = "الملاحظة طويلة جداً.";

  if (!opts.colors.includes(input.color)) e.color = "اختر اللون.";

  const q = input.quantity;
  if (!Number.isInteger(q) || q < 1) e.quantity = "الكمية يجب أن تكون 1 على الأقل.";
  else if (q > opts.maxPerOrder) e.quantity = `الحد الأقصى ${opts.maxPerOrder} قطع في الطلب الواحد.`;

  if (!ZONES.includes(input.zone)) e.zone = "اختر منطقة التوصيل.";
  return e;
}
