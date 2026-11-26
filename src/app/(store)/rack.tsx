"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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

type Tab = { key: "rack" | "salad"; label: string; img: string };

/** Two full product pages under one switch: the customer picks which product to see. */
export function ProductPages({ initial, tabs, rack, salad }: { initial: "rack" | "salad"; tabs: Tab[]; rack: ReactNode; salad: ReactNode }) {
  const [view, setView] = useState<"rack" | "salad">(initial);

  // remember the choice in the address (?p=salad) so a reload or a shared link keeps it
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("p");
    const start = tabs.length && (q === "rack" || q === "salad") ? q : initial;
    setView(start);
    // let the order form mount first, then pick the same product there
    const t = setTimeout(() => chooseItem(start), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (k: "rack" | "salad") => {
    if (k === view) return;
    setView(k);
    chooseItem(k);
    const u = new URL(location.href);
    u.searchParams.set("p", k);
    u.hash = "";
    history.replaceState(null, "", u);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  return (
    <>
      {tabs.length > 1 && (
        <div className="page-tabs" role="tablist" aria-label="منتجاتنا">
          {tabs.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={view === x.key} onClick={() => pick(x.key)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.img} alt="" width={x.key === "rack" ? 54 : 22} height={36} />
              {x.label}
            </button>
          ))}
        </div>
      )}
      <div key={view} className="page-view">
        {view === "rack" ? rack : salad}
      </div>
    </>
  );
}

/** The other product, small, so it can be bought too without leaving the page. */
export function MiniProduct({ item, name, price, note, img, open }: { item: "rack" | "salad"; name: string; price: string; note: string; img: string; open: boolean }) {
  const tilt = useTilt<HTMLDivElement>();
  return (
    <section className="mini-wrap" aria-label={`اطلب أيضاً ${name}`}>
      <div ref={tilt} className={`mini-card mini-${item}`} data-reveal>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt="" width={item === "rack" ? 150 : 70} height={item === "rack" ? 97 : 126} loading="lazy" />
        <div className="mini-info">
          <p className="eyebrow">اطلب أيضاً</p>
          <h3>{name}</h3>
          <div className="mini-buy">
            <strong>{price || "السعر يُعلن قريباً"}</strong>
            {note && price && <span className="mini-note">{note}</span>}
          </div>
        </div>
        {open && (
          <a
            className="btn btn-primary mini-btn"
            href="#order"
            onClick={(e) => {
              e.preventDefault();
              chooseItem(item);
              document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            اطلب
          </a>
        )}
      </div>
    </section>
  );
}
