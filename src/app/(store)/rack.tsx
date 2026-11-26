"use client";

import { useEffect, useRef, useState } from "react";
import { useTilt } from "./offers";

/** Tells the order form which product the customer wants. */
export const ITEM_EVENT = "promax:item";
export function chooseItem(item: "salad" | "rack") {
  window.dispatchEvent(new CustomEvent(ITEM_EVENT, { detail: item }));
}

export type RackView = {
  name: string;
  priceCents: number; // 0 = price not announced yet
  orderable: boolean;
  headline: string;
  intro: string;
  featuresTitle: string;
  features: string[];
  outro: string;
};

const SHOTS = [
  { src: "/product/rack/open-720.webp", hi: "/product/rack/open-1400.webp", label: "مفتوح للتجفيف" },
  { src: "/product/rack/covered-720.webp", hi: "/product/rack/covered-1400.webp", label: "مع الغطاء الحراري" },
];

/** Splits a leading emoji off a line so it can sit in its own 3D chip. */
function splitIcon(line: string): [string, string] {
  const m = line.match(/^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*(.*)$/u);
  return m ? [m[1], m[2]] : ["", line];
}

/** 3D turntable for the rack: flips between the open and covered photos. Used in the hero. */
export function RackStage({ name, eager = false }: { name: string; eager?: boolean }) {
  const tilt = useTilt<HTMLDivElement>();
  const [side, setSide] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!paused.current) setSide((s) => (s + 1) % 2);
    }, 4200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rack-stage-wrap">
      <div
        ref={tilt}
        className="rack-stage"
        onPointerEnter={() => (paused.current = true)}
        onPointerLeave={() => (paused.current = false)}
        onClick={() => setSide((s) => (s + 1) % 2)}
      >
        <div className={`rack-flip${side ? " flipped" : ""}`}>
          {SHOTS.map((s, i) => (
            <figure key={s.src} className={`rack-face f${i}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.src}
                srcSet={`${s.src} 720w, ${s.hi} 1400w`}
                sizes="(min-width: 960px) 560px, 92vw"
                alt={`${name}، ${s.label}`}
                width={720}
                height={464}
                loading={eager ? "eager" : "lazy"}
                fetchPriority={eager && i === 0 ? "high" : undefined}
                decoding="async"
              />
              <figcaption>{s.label}</figcaption>
            </figure>
          ))}
        </div>
        <span className="rack-shine" aria-hidden />
      </div>
      <div className="rack-dots" role="group" aria-label="صور المنشر">
        {SHOTS.map((s, i) => (
          <button key={s.src} type="button" aria-pressed={side === i} onClick={() => setSide(i)}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Details of the rack under the hero: the owner's text, features and the video. */
export function RackSection({ r }: { r: RackView }) {
  return (
    <section className="rack" id="rack" aria-labelledby="rack-title">
      <div className="rack-bg" aria-hidden />
      <div className="rack-grid">
        <div className="rack-copy">
          {r.headline && (
            <h2 className="rack-headline" id="rack-title" data-reveal>
              {r.headline}
            </h2>
          )}
          {r.features.length > 0 && (
            <>
              {r.featuresTitle && (
                <p className="rack-ftitle" data-reveal>
                  {r.featuresTitle}
                </p>
              )}
              <ul className="rack-features">
                {r.features.map((f, i) => {
                  const [icon, text] = splitIcon(f);
                  return (
                    <li key={f} data-reveal style={{ ["--d" as string]: `${i * 70}ms` }}>
                      {icon && (
                        <span className="rack-icon" aria-hidden>
                          {icon}
                        </span>
                      )}
                      <span>{text}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {r.outro && (
            <p className="rack-outro" data-reveal>
              {r.outro}
            </p>
          )}
        </div>
        <div className="rack-video-wrap" data-reveal>
          <p className="eyebrow">شاهد المنشر</p>
          <video
            className="rack-video"
            src="/product/rack/video.mp4"
            poster="/product/rack/video-poster.webp"
            controls
            playsInline
            preload="none"
            width={464}
            height={832}
            aria-label={`فيديو ${r.name}`}
          />
        </div>
      </div>
    </section>
  );
}

/** The salad maker, now a simple card: picture, price, order button. */
export function SaladSimple({ name, sub, price, badge, open }: { name: string; sub: string; price: string; badge: string; open: boolean }) {
  const tilt = useTilt<HTMLDivElement>();
  return (
    <section className="salad-simple" id="salad" aria-labelledby="salad-title">
      <div ref={tilt} className="salad-card" data-reveal>
        <div className="salad-pics" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/product/cut-black-700.webp" alt="" width={140} height={252} loading="lazy" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/product/cut-beige-700.webp" alt="" width={140} height={252} loading="lazy" />
        </div>
        <div className="salad-info">
          {badge && <span className="salad-badge">{badge}</span>}
          <h2 id="salad-title">{name}</h2>
          {sub && <p className="muted">{sub}</p>}
          <div className="salad-buy">
            <strong>{price || "السعر يُعلن قريباً"}</strong>
            {open && (
              <a
                className="btn btn-primary"
                href="#order"
                onClick={(e) => {
                  e.preventDefault();
                  chooseItem("salad");
                  document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                اطلب الآن
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Hero order button: picks the rack in the form, then scrolls there. */
export function OrderRackButton({ label }: { label: string }) {
  return (
    <a
      className="btn btn-primary btn-large"
      href="#order"
      onClick={(e) => {
        e.preventDefault();
        chooseItem("rack");
        document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
      }}
    >
      {label}
    </a>
  );
}


type HeroItem = { key: "rack" | "salad"; tab: string; name: string; lede: string; price: string; orderable: boolean };

/** Hero with both products: a 3D swing between the rack and the salad maker. */
export function HeroShowcase({ items, storeName, contactHref, rackName }: { items: HeroItem[]; storeName: string; contactHref: string; rackName: string }) {
  const [active, setActive] = useState(0);
  const it = items[active];
  return (
    <section className="hero hero-rack hero-duo" aria-labelledby="hero-title">
      <div className="hero-stage">
        <div className="duo-scene">
          <span className="duo-ring" aria-hidden />
          <span className="duo-ring r2" aria-hidden />
          {items.map((x, i) => (
            <div key={x.key} className={`duo-face${i === active ? " on" : i < active ? " before" : " after"}`} aria-hidden={i !== active}>
              {x.key === "rack" ? (
                <RackStage name={rackName} eager />
              ) : (
                <div className="duo-salad">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/product/cut-black-700.webp" srcSet="/product/cut-black-700.webp 1x, /product/cut-black.webp 2x" alt={`${x.name} باللون الأسود`} width={220} height={396} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/product/cut-beige-700.webp" srcSet="/product/cut-beige-700.webp 1x, /product/cut-beige.webp 2x" alt={`${x.name} باللون البيج`} width={220} height={396} />
                </div>
              )}
            </div>
          ))}
          <span className="duo-floor" aria-hidden />
        </div>
      </div>
      <div className="hero-copy">
        {items.length > 1 && (
          <div className="duo-tabs" role="tablist" aria-label="منتجاتنا">
            {items.map((x, i) => (
              <button key={x.key} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.key === "rack" ? "/product/rack/open-720.webp" : "/product/cut-black-700.webp"} alt="" width={x.key === "rack" ? 54 : 22} height={36} />
                {x.tab}
              </button>
            ))}
          </div>
        )}
        <div key={it.key} className="duo-copy">
          <p className="eyebrow">
            <span dir="ltr">{storeName}</span>
          </p>
          <h1 id="hero-title">{it.name}</h1>
          {it.lede && <p className="lede">{it.lede}</p>}
          <div className="price-row">
            {it.price ? <span className="price">{it.price}</span> : <span className="price price-pending">السعر يُعلن قريباً</span>}
            <span className="cod-pill">الدفع عند الاستلام</span>
          </div>
          <div className="hero-actions" id="hero-cta">
            {it.orderable ? (
              <a
                className="btn btn-primary btn-large"
                href="#order"
                onClick={(e) => {
                  e.preventDefault();
                  chooseItem(it.key);
                  document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                اطلب الآن
              </a>
            ) : (
              <a className="btn btn-primary btn-large" href={contactHref || "#order"}>
                تواصل معنا للطلب
              </a>
            )}
          </div>
        </div>
      </div>
      <a href={it.key === "rack" ? "#rack" : "#salad"} className="scroll-cue" aria-label="اكتشف المزيد">
        <span aria-hidden />
      </a>
    </section>
  );
}
