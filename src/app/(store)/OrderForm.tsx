"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { placeOrder, type OrderState } from "./actions";
import { useSelectedColor } from "./client";
import { validateOrder, type FieldErrors, type OrderInput } from "@/lib/validation";
import { CheckIcon } from "./icons";

type Props = {
  /** Generated on the server per page view; retries of the same submit reuse it. */
  idempotencyKey: string;
  open: boolean;
  unitCents: number;
  currency: string;
  deliveryFeeCents: number;
  freeDeliveryFromCents: number;
  maxPerOrder: number;
  colors: { key: string; label: string; available: boolean }[];
  privacyNote: string;
  supportPhone: string;
  deliveryEstimate: string;
};

function money(cents: number, currency: string) {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("ar-u-nu-latn", {
      style: "currency",
      currency,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return String(amount);
  }
}

const FIELD_ORDER: (keyof OrderInput)[] = ["color", "quantity", "name", "phone", "address", "area", "note", "consent"];

export function OrderForm(p: Props) {
  const [state, action, pending] = useActionState<OrderState, FormData>(placeOrder, { status: "idle" });
  const available = p.colors.filter((c) => c.available);
  const [color, setColor] = useSelectedColor(available[0]?.key ?? "");
  const [qty, setQty] = useState(1);
  const key = p.idempotencyKey;
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const serverErrors = state.status === "error" ? state.fieldErrors ?? {} : {};
  const errors: FieldErrors = touched ? clientErrors : serverErrors;

  useEffect(() => {
    if (state.status === "success") successRef.current?.focus();
    if (state.status === "error") {
      const first = FIELD_ORDER.find((f) => state.fieldErrors?.[f]);
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      else errorRef.current?.focus();
      setTouched(false);
    }
  }, [state]);

  const subtotal = p.unitCents * qty;
  const fee = p.freeDeliveryFromCents > 0 && subtotal >= p.freeDeliveryFromCents ? 0 : p.deliveryFeeCents;
  const total = subtotal + fee;

  const values = state.status === "error" ? state.values ?? {} : {};

  function readForm(form: HTMLFormElement): OrderInput {
    const fd = new FormData(form);
    const s = (k: string) => (typeof fd.get(k) === "string" ? String(fd.get(k)) : "");
    return {
      name: s("name"),
      phone: s("phone"),
      address: s("address"),
      area: s("area"),
      note: s("note"),
      color: s("color"),
      quantity: Number(s("quantity")),
      consent: s("consent") === "on",
    };
  }

  const opts = useMemo(
    () => ({ maxPerOrder: p.maxPerOrder, colors: available.map((c) => c.key) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.maxPerOrder, p.colors],
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Submit manually so the customer's typing is never reset by React after a
    // server-side error. Without JS the native form post still reaches the action.
    e.preventDefault();
    if (pending) return;
    const errs = validateOrder(readForm(e.currentTarget), opts);
    if (!Object.keys(errs).length) {
      setClientErrors({});
      const fd = new FormData(e.currentTarget);
      startTransition(() => action(fd));
      return;
    }
    setClientErrors(errs);
    setTouched(true);
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (first) e.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }

  function onBlurValidate() {
    if (!touched || !formRef.current) return;
    setClientErrors(validateOrder(readForm(formRef.current), opts));
  }

  if (state.status === "success") {
    return (
      <div className="order-success" ref={successRef} tabIndex={-1} role="status" aria-live="polite">
        <div className="success-badge" aria-hidden>
          <CheckIcon />
        </div>
        <h3>تم استلام طلبك، شكراً {state.name}!</h3>
        <p className="success-ref">
          رقم الطلب: <strong dir="ltr">{state.ref}</strong>
        </p>
        <dl className="success-summary">
          <div>
            <dt>اللون</dt>
            <dd>{state.color}</dd>
          </div>
          <div>
            <dt>الكمية</dt>
            <dd>{state.quantity}</dd>
          </div>
          <div>
            <dt>المبلغ عند الاستلام</dt>
            <dd>{state.total}</dd>
          </div>
        </dl>
        <p>
          سنتصل بك على الرقم <bdi dir="ltr">{state.phone}</bdi> لتأكيد الطلب والعنوان
          {p.deliveryEstimate ? `، والتوصيل المتوقع: ${p.deliveryEstimate}.` : "."} ستدفع نقداً عند الاستلام.
        </p>
        <p className="muted">احتفظ برقم الطلب في حال احتجت للتواصل معنا.</p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            window.location.hash = "order";
            window.location.reload();
          }}
        >
          طلب جديد
        </button>
      </div>
    );
  }

  if (!p.open) {
    return (
      <div className="order-closed" role="status">
        <h3>الطلب عبر الموقع غير متاح حالياً</h3>
        <p>
          {p.supportPhone ? (
            <>
              للطلب أو الاستفسار اتصل بنا على <a href={`tel:${p.supportPhone}`} dir="ltr">{p.supportPhone}</a>.
            </>
          ) : (
            "سيُفتح الطلب قريباً."
          )}
        </p>
      </div>
    );
  }

  const err = (k: keyof OrderInput) =>
    errors[k] ? (
      <p className="field-error" id={`err-${k}`}>
        {errors[k]}
      </p>
    ) : null;
  const a11y = (k: keyof OrderInput) => ({
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `err-${k}` : undefined,
  });

  return (
    <form ref={formRef} action={action} onSubmit={onSubmit} noValidate className="order-form" aria-describedby="cod-note">
      <input type="hidden" name="idempotencyKey" value={key} />
      <div className="hp" aria-hidden>
        <label>
          اترك هذا الحقل فارغاً
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset className="field">
        <legend>اللون</legend>
        <div className="color-options">
          {available.map((c) => (
            <label key={c.key} className={`color-option swatch-${c.key}`}>
              <input
                type="radio"
                name="color"
                value={c.key}
                checked={color === c.key}
                onChange={() => setColor(c.key)}
                {...a11y("color")}
              />
              <span className="dot" aria-hidden />
              {c.label}
            </label>
          ))}
        </div>
        {err("color")}
      </fieldset>

      <div className="field">
        <label htmlFor="quantity">الكمية</label>
        <div className="qty">
          <button type="button" aria-label="إنقاص الكمية" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>
            −
          </button>
          <input
            id="quantity"
            name="quantity"
            inputMode="numeric"
            value={qty}
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
              setQty(Number.isFinite(n) ? Math.min(Math.max(n, 1), p.maxPerOrder) : 1);
            }}
            {...a11y("quantity")}
          />
          <button
            type="button"
            aria-label="زيادة الكمية"
            onClick={() => setQty((q) => Math.min(p.maxPerOrder, q + 1))}
            disabled={qty >= p.maxPerOrder}
          >
            +
          </button>
        </div>
        {err("quantity")}
      </div>

      <div className="field">
        <label htmlFor="name">الاسم الكامل</label>
        <input id="name" name="name" autoComplete="name" defaultValue={values.name} onBlur={onBlurValidate} maxLength={80} {...a11y("name")} />
        {err("name")}
      </div>

      <div className="field">
        <label htmlFor="phone">رقم الهاتف</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          defaultValue={values.phone}
          onBlur={onBlurValidate}
          maxLength={24}
          {...a11y("phone")}
        />
        <p className="hint">سنتصل بك على هذا الرقم لتأكيد الطلب.</p>
        {err("phone")}
      </div>

      <div className="field">
        <label htmlFor="address">عنوان التوصيل</label>
        <textarea
          id="address"
          name="address"
          rows={2}
          autoComplete="street-address"
          defaultValue={values.address}
          onBlur={onBlurValidate}
          maxLength={300}
          placeholder="المدينة، الحي، الشارع، رقم المبنى"
          {...a11y("address")}
        />
        {err("address")}
      </div>

      <div className="field">
        <label htmlFor="area">
          المنطقة / المدينة <span className="optional">(اختياري)</span>
        </label>
        <input id="area" name="area" autoComplete="address-level2" defaultValue={values.area} maxLength={80} {...a11y("area")} />
        {err("area")}
      </div>

      <div className="field">
        <label htmlFor="note">
          ملاحظة للتوصيل <span className="optional">(اختياري)</span>
        </label>
        <input id="note" name="note" defaultValue={values.note} maxLength={300} placeholder="مثال: أفضل وقت للاتصال" {...a11y("note")} />
        {err("note")}
      </div>

      <div className="summary" aria-live="polite">
        <div>
          <span>السعر × {qty}</span>
          <span>{money(subtotal, p.currency)}</span>
        </div>
        <div>
          <span>التوصيل</span>
          <span>{fee === 0 ? (p.deliveryFeeCents === 0 ? "مجاني" : "مجاني لهذا الطلب") : money(fee, p.currency)}</span>
        </div>
        <div className="summary-total">
          <span>الإجمالي عند الاستلام</span>
          <strong>{money(total, p.currency)}</strong>
        </div>
      </div>

      <p className="cod-note" id="cod-note">
        <strong>الدفع نقداً عند الاستلام.</strong> لا تحتاج إلى بطاقة، ولن نطلب منك أي بيانات دفع.
      </p>

      <div className="field consent">
        <label>
          <input type="checkbox" name="consent" onChange={onBlurValidate} {...a11y("consent")} />
          <span>{p.privacyNote}</span>
        </label>
        {err("consent")}
      </div>

      {state.status === "error" && (
        <p className="form-error" role="alert" ref={errorRef} tabIndex={-1}>
          {state.message}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={pending} aria-busy={pending}>
        {pending ? "جارٍ إرسال الطلب…" : `تأكيد الطلب — ${money(total, p.currency)}`}
      </button>
    </form>
  );
}
