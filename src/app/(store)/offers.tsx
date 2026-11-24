"use client";

import { useEffect, useRef, useState } from "react";

export type OfferView = {
  id: string;
  title: string;
  quantity: number;
  priceCents: number;
  includesDelivery: boolean;
  badge: string;
  theme: "standard" | "blackfriday";
  /** epoch ms when the offer ends, 0 = no end */
  endsAt: number;
  /** what the same items cost without the offer (units + cheapest delivery), for the strike-through */
  normalCents: number;
};

export const OFFER_EVENT = "promax:offer";

export function chooseOffer(id: string) {
  window.dispatchEvent(new CustomEvent(OFFER_EVENT, { detail: id }));
}

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

const PICS = ["/product/cut-black-700.webp", "/product/cut-beige-700.webp"];

/** Pointer / device tilt for one 3D card. */
function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const apply = (x: number, y: number) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--rx", `${(-y * 10).toFixed(2)}deg`);
        el.style.setProperty("--ry", `${(x * 14).toFixed(2)}deg`);
        el.style.setProperty("--mx", `${((x + 1) * 50).toFixed(1)}%`);
        el.style.setProperty("--my", `${((y + 1) * 50).toFixed(1)}%`);
      });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      apply(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    };
    const onLeave = () => apply(0, 0);
    // phones: follow scroll position for a gentle parallax tilt
    const onScroll = () => {
      if (!matchMedia("(hover: none)").matches) return;
      const r = el.getBoundingClientRect();
      const t = (r.top + r.height / 2) / innerHeight - 0.5;
      apply(Math.max(-1, Math.min(1, t * 0.6)) * 0.6, Math.max(-1, Math.min(1, t)) * 0.8);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      removeEventListener("scroll", onScroll);
    };
  }, []);
  return ref;
}

function Countdown({ to }: { to: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;
  const left = Math.max(0, to - now);
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left / 3_600_000) % 24);
  const m = Math.floor((left / 60_000) % 60);
  const sec = Math.floor((left / 1000) % 60);
  const cell = (v: number, l: string) => (
    <span className="cd-cell">
      <b>{String(v).padStart(2, "0")}</b>
      <small>{l}</small>
    </span>
  );
  return (
    <div className="countdown" role="timer" aria-label="الوقت المتبقي للعرض">
      <span className="cd-title">ينتهي العرض خلال</span>
      <div className="cd-row" dir="ltr">
        {cell(d, "يوم")}
        {cell(h, "ساعة")}
        {cell(m, "دقيقة")}
        {cell(sec, "ثانية")}
      </div>
    </div>
  );
}

function OfferCard({ o, currency, featured }: { o: OfferView; currency: string; featured: boolean }) {
  const ref = useTilt<HTMLElement>();
  const shown = Math.min(o.quantity, 3);
  const saving = o.normalCents - o.priceCents;
  return (
    <article ref={ref} className={`offer3d${featured ? " featured" : ""}${o.theme === "blackfriday" ? " bf" : ""}`} data-reveal>
      <div className="offer3d-inner">
        <span className="offer3d-glow" aria-hidden />
        {o.badge && <span className="offer3d-ribbon">{o.badge}</span>}
        {o.theme === "blackfriday" && (
          <div className="bf-title" aria-hidden>
            <span>BLACK</span>
            <span>FRIDAY</span>
          </div>
        )}

        <div className={`offer3d-stage n${shown}`} aria-hidden>
          <span className="offer3d-orbit" />
          <span className="offer3d-orbit o2" />
          {Array.from({ length: shown }, (_, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={PICS[i % 2]} alt="" width={180} height={324} loading="lazy" decoding="async" style={{ ["--n" as string]: i }} />
          ))}
          {o.quantity > 1 && <span className="offer3d-qty" dir="ltr">x{o.quantity}</span>}
        </div>

        <div className="offer3d-copy">
          <h3>{o.title}</h3>
          <p className="offer3d-sub">
            {o.quantity === 1 ? "قطعة Pro Max" : `${o.quantity} قطع Pro Max`}{o.includesDelivery ? " مع التوصيل لباب البيت" : ""}{o.quantity > 1 ? "، اختر لون كل قطعة." : "."}
          </p>
          <div className="offer3d-price">
            <strong>{money(o.priceCents, currency)}</strong>
            {saving > 0 && <s>{money(o.normalCents, currency)}</s>}
          </div>
          {o.endsAt > 0 && <Countdown to={o.endsAt} />}
          <div className="offer3d-chips">
            {o.includesDelivery && <span className="chip-hot">شامل التوصيل</span>}
            {saving > 0 && <span>وفّر {money(saving, currency)}</span>}
            <span>الدفع عند الاستلام</span>
          </div>
          <a
            href="#order"
            className="btn btn-primary btn-block offer3d-cta"
            onClick={() => chooseOffer(o.id)}
          >
            اطلب العرض الآن
          </a>
        </div>
      </div>
    </article>
  );
}

export function OffersSection({ offers, currency }: { offers: OfferView[]; currency: string }) {
  if (!offers.length) return null;
  return (
    <section className="offers" aria-labelledby="offers-title">
      <div className="offers-bg" aria-hidden />
      <div className="offers-head" data-reveal>
        <p className="eyebrow">{offers.some((o) => o.theme === "blackfriday") ? "Black Friday · الجمعة السوداء" : "عرض لفترة محدودة"}</p>
        <h2 id="offers-title">{offers.length === 1 ? offers[0].title : "عروض Pro Max"}</h2>
      </div>
      <div className={`offers-grid c${Math.min(offers.length, 3)}`}>
        {offers.map((o, i) => (
          <OfferCard key={o.id} o={o} currency={currency} featured={i === 0} />
        ))}
      </div>
    </section>
  );
}
