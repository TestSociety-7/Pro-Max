"use client";

import { useEffect, useRef, useState } from "react";
import { money, useTilt } from "./offers";

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

export function RackSection({ r, currency, contactHref }: { r: RackView; currency: string; contactHref: string }) {
  const tilt = useTilt<HTMLDivElement>();
  const [side, setSide] = useState(0);
  const paused = useRef(false);

  // the stage flips between "open" and "covered" on its own, like a turntable
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!paused.current) setSide((s) => (s + 1) % 2);
    }, 4200);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="rack" id="rack" aria-labelledby="rack-title">
      <div className="rack-bg" aria-hidden />
      <div className="rack-head" data-reveal>
        <p className="eyebrow">منتج جديد</p>
        <h2 id="rack-title">{r.name}</h2>
      </div>

      <div className="rack-grid">
        <div className="rack-stage-wrap" data-reveal>
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
                    sizes="(min-width: 960px) 520px, 92vw"
                    alt={`${r.name}، ${s.label}`}
                    width={720}
                    height={464}
                    loading="lazy"
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

        <div className="rack-copy">
          {r.headline && (
            <h3 className="rack-headline" data-reveal>
              {r.headline}
            </h3>
          )}
          {r.intro && (
            <p className="rack-intro" data-reveal>
              {r.intro}
            </p>
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

          <div className="rack-buy" data-reveal>
            <div className="rack-price">
              {r.priceCents > 0 ? <strong>{money(r.priceCents, currency)}</strong> : <strong className="soon">السعر يُعلن قريباً</strong>}
              <span className="rack-cod">الدفع عند الاستلام</span>
            </div>
            {r.orderable ? (
              <a
                className="btn btn-primary btn-large btn-block"
                href="#order"
                onClick={(e) => {
                  e.preventDefault();
                  chooseItem("rack");
                  document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                اطلب المنشر الآن
              </a>
            ) : (
              contactHref && (
                <a className="btn btn-ghost btn-block" href={contactHref} target="_blank" rel="noopener noreferrer">
                  اسألنا عن المنشر
                </a>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Two tiles under the hero so both products are seen straight away. */
export function ProductTiles({ saladName, rackName, saladHref }: { saladName: string; rackName: string; saladHref: string }) {
  return (
    <nav className="ptiles" aria-label="منتجاتنا">
      <a href={saladHref} className="ptile">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/product/cut-black-700.webp" alt="" width={90} height={162} loading="lazy" />
        <span>{saladName}</span>
      </a>
      <a href="#rack" className="ptile">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/product/rack/open-720.webp" alt="" width={140} height={90} loading="lazy" />
        <span>{rackName}</span>
      </a>
    </nav>
  );
}
