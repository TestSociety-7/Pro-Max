"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { placeOrder, type OrderState } from "./actions";
import { useSelectedColor } from "./client";
import { validateOrder, type FieldErrors, type OrderInput } from "@/lib/validation";
import { CheckIcon, WhatsAppIcon } from "./icons";
import { Celebration } from "./showcase";
import { OFFER_EVENT, type OfferView } from "./offers";

type Props = {
  /** Generated on the server per page view; retries of the same submit reuse it. */
  idempotencyKey: string;
  open: boolean;
  unitCents: number;
  currency: string;
  zones: { key: string; label: string; feeCents: number }[];
  freeDeliveryFromCents: number;
  maxPerOrder: number;
  colors: { key: string; label: string; available: boolean }[];
  supportPhone: string;
  deliveryEstimate: string;
  offers: OfferView[];
  /** after saving, the customer is sent to WhatsApp with the order message */
  whatsappCheckout: boolean;
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

const FIELD_ORDER: (keyof OrderInput)[] = ["color", "quantity", "zone", "name", "phone", "area", "address", "note"];

export function OrderForm(p: Props) {
  const [state, action, pending] = useActionState<OrderState, FormData>(placeOrder, { status: "idle" });
  const available = p.colors.filter((c) => c.available);
  const [color, setColor] = useSelectedColor(available[0]?.key ?? "");
  const [qty, setQty] = useState(1);
  // with a single delivery area there is nothing to choose
  const [zone, setZone] = useState(p.zones.length === 1 ? p.zones[0].key : "");
  // when an offer is active it is the only choice, picked for the customer
  const [offerId, setOfferId] = useState(p.offers[0]?.id ?? "");
  const [unitColors, setUnitColors] = useState<string[]>([]);
  const offer = p.offers.find((o) => o.id === offerId);
  const packRef = useRef<HTMLFieldSetElement>(null);

  // "Order this offer" buttons on the page pick it here
  useEffect(() => {
    const on = (e: Event) => {
      const id = String((e as CustomEvent).detail ?? "");
      if (!p.offers.some((o) => o.id === id)) return;
      setOfferId(id);
      packRef.current?.classList.remove("flash-pick");
      void packRef.current?.offsetWidth;
      packRef.current?.classList.add("flash-pick");
    };
    window.addEventListener(OFFER_EVENT, on);
    return () => window.removeEventListener(OFFER_EVENT, on);
  }, [p.offers]);
  const key = p.idempotencyKey;
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const serverErrors = state.status === "error" ? state.fieldErrors ?? {} : {};
  const errors: FieldErrors = touched ? clientErrors : serverErrors;

  useEffect(() => {
    if (state.status === "success" && state.whatsappUrl) {
      // Hand the order to WhatsApp so the store gets it as a message too.
      // WhatsApp first: hand the order message over straight away
      const t = setTimeout(() => window.location.assign(state.whatsappUrl), 150);
      return () => clearTimeout(t);
    }
  }, [state]);

  useEffect(() => {
    if (state.status === "success") successRef.current?.focus();
    if (state.status === "error") {
      const first = FIELD_ORDER.find((f) => state.fieldErrors?.[f]);
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      else errorRef.current?.focus();
      setTouched(false);
    }
  }, [state]);

  const subtotal = offer ? offer.priceCents : p.unitCents * qty;
  const zoneFeeCents = p.zones.find((z) => z.key === zone)?.feeCents ?? 0;
  const fee =
    !zone || offer?.includesDelivery
      ? 0
      : p.freeDeliveryFromCents > 0 && subtotal >= p.freeDeliveryFromCents
        ? 0
        : zoneFeeCents;
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
      zone: s("zone"),
    };
  }

  const opts = useMemo(
    () => ({ maxPerOrder: offer ? offer.quantity : p.maxPerOrder, colors: available.map((c) => c.key) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.maxPerOrder, p.colors, offer],
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
        <Celebration run />
        <div className="success-3d" aria-hidden>
          <span className="success-ring" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={color === "beige" ? "/product/cut-beige-700.webp" : "/product/cut-black-700.webp"}
            srcSet={color === "beige" ? "/product/cut-beige-700.webp 1x, /product/cut-beige.webp 2x" : "/product/cut-black-700.webp 1x, /product/cut-black.webp 2x"}
            alt=""
            width={200}
            height={360}
          />
          <span className="success-badge">
            <CheckIcon />
          </span>
        </div>
        <h3>تم استلام طلبك، شكراً {state.name}!</h3>
        {state.whatsappUrl && (
          <ol className="wa-steps">
            <li className="done">
              <span aria-hidden>✓</span> تم حفظ الطلب
            </li>
            <li className="now">
              <span aria-hidden>2</span> أرسل رسالة الطلب على واتساب لتأكيده
            </li>
          </ol>
        )}
        {state.whatsappUrl && (
          <a className="btn btn-whatsapp btn-block wa-primary" href={state.whatsappUrl}>
            <WhatsAppIcon /> إرسال الطلب على واتساب
          </a>
        )}
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

      {p.offers.length > 0 && (
        <fieldset className="field" ref={packRef}>
          <legend>{p.offers.length > 1 ? "اختر العرض" : "العرض"}</legend>
          <div className="pack-options">
            {p.offers.map((o) => (
              <label key={o.id} className="pack-option">
                {o.badge && <span className="pack-tag">{o.badge}</span>}
                <input type="radio" name="pack" value={o.id} checked={offerId === o.id} onChange={() => setOfferId(o.id)} />
                <span className="pack-dot" aria-hidden />
                <span className="pack-name">
                  {o.title}
                  <small>
                    {o.quantity === 1 ? "قطعة واحدة" : `${o.quantity} قطع`}{o.includesDelivery ? " · شامل التوصيل" : ""}
                  </small>
                </span>
                <span className="pack-price">{money(o.priceCents, p.currency)}</span>
              </label>
            ))}
          </div>
          {offer && <input type="hidden" name="offer" value={offer.id} />}
        </fieldset>
      )}

      <fieldset className="field">
        <legend>{offer ? "لون كل قطعة" : "اللون"}</legend>
        <div className={offer ? "unit-color" : undefined}>
          {offer && <span className="unit-label">القطعة 1</span>}
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
        </div>
        {offer &&
          Array.from({ length: offer.quantity - 1 }, (_, k) => {
            const n = k + 2;
            const val = unitColors[n] ?? color;
            return (
              <div key={n} className="unit-color">
                <span className="unit-label">القطعة {n}</span>
                <div className="color-options">
                  {available.map((c) => (
                    <label key={c.key} className={`color-option swatch-${c.key}`}>
                      <input
                        type="radio"
                        name={`color_${n}`}
                        value={c.key}
                        checked={val === c.key}
                        onChange={() =>
                          setUnitColors((u) => {
                            const x = [...u];
                            x[n] = c.key;
                            return x;
                          })
                        }
                      />
                      <span className="dot" aria-hidden />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        {err("color")}
      </fieldset>

      {offer ? (
        <input type="hidden" name="quantity" value={offer.quantity} />
      ) : (
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
      )}

      {p.zones.length === 1 ? (
        <input type="hidden" name="zone" value={p.zones[0].key} />
      ) : (
        <fieldset className="field">
          <legend>منطقة التوصيل</legend>
          <div className="zone-options">
            {p.zones.map((z) => (
              <label key={z.key} className="zone-option">
                <input
                  type="radio"
                  name="zone"
                  value={z.key}
                  checked={zone === z.key}
                  onChange={() => {
                    setZone(z.key);
                    if (touched && formRef.current) setClientErrors(validateOrder({ ...readForm(formRef.current), zone: z.key }, opts));
                  }}
                  {...a11y("zone")}
                />
                <span className="zone-name">{z.label}</span>
                <span className="zone-fee">{z.feeCents ? `+ ${money(z.feeCents, p.currency)}` : "مشمول في السعر"}</span>
              </label>
            ))}
          </div>
          {err("zone")}
        </fieldset>
      )}

      <div className="field-row">
        <div className="field">
          <label htmlFor="name">الاسم</label>
          <input id="name" name="name" autoComplete="name" defaultValue={values.name} onBlur={onBlurValidate} maxLength={80} enterKeyHint="next" {...a11y("name")} />
          {err("name")}
        </div>

        <div className="field">
          <label htmlFor="phone">الهاتف</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder="05X XXX XXXX"
            defaultValue={values.phone}
            onBlur={onBlurValidate}
            maxLength={24}
            enterKeyHint="next"
            {...a11y("phone")}
          />
          {err("phone")}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="area">المدينة / البلدة</label>
          <input
            id="area"
            name="area"
            autoComplete="address-level2"
            defaultValue={values.area}
            onBlur={onBlurValidate}
            maxLength={80}
            enterKeyHint="next"
            {...a11y("area")}
          />
          {err("area")}
        </div>

        <div className="field">
          <label htmlFor="address">العنوان</label>
          <input
            id="address"
            name="address"
            autoComplete="street-address"
            defaultValue={values.address}
            onBlur={onBlurValidate}
            maxLength={300}
            placeholder="الحي أو الشارع"
            enterKeyHint="done"
            {...a11y("address")}
          />
          {err("address")}
        </div>
      </div>
      <input type="hidden" name="note" value="" />

      <div className="summary" aria-live="polite">
        <div>
          <span>{offer ? offer.title : `السعر × ${qty}`}</span>
          <span>{money(subtotal, p.currency)}</span>
        </div>
        <div>
          <span>التوصيل</span>
          <span>{offer?.includesDelivery ? "مشمول في العرض" : !zone ? "اختر المنطقة" : fee === 0 ? (zoneFeeCents === 0 ? "مشمول في السعر" : "مجاني لهذا الطلب") : money(fee, p.currency)}</span>
        </div>
        <div className="summary-total">
          <span>الإجمالي عند الاستلام</span>
          <strong>{money(total, p.currency)}</strong>
        </div>
      </div>

      <p className="cod-note" id="cod-note">
        <strong>الدفع نقداً عند الاستلام.</strong> لا تحتاج إلى بطاقة، ولن نطلب منك أي بيانات دفع.
      </p>

      {state.status === "error" && (
        <p className="form-error" role="alert" ref={errorRef} tabIndex={-1}>
          {state.message}
        </p>
      )}

      <button
        type="submit"
        className={`btn btn-block ${p.whatsappCheckout ? "btn-whatsapp" : "btn-primary"}`}
        disabled={pending}
        aria-busy={pending}
      >
        {p.whatsappCheckout && !pending && <WhatsAppIcon />}
        {pending
          ? p.whatsappCheckout
            ? "جارٍ فتح واتساب…"
            : "جارٍ إرسال الطلب…"
          : p.whatsappCheckout
            ? `أرسل الطلب على واتساب — ${money(total, p.currency)}`
            : `تأكيد الطلب — ${money(total, p.currency)}`}
      </button>
    </form>
  );
}
