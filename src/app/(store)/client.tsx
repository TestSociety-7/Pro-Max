"use client";

import { useEffect, useState } from "react";

const COLOR_EVENT = "promax:color";

export function selectColor(key: string) {
  window.dispatchEvent(new CustomEvent(COLOR_EVENT, { detail: key }));
}

export function useSelectedColor(initial: string): [string, (k: string) => void] {
  const [color, setColor] = useState(initial);
  useEffect(() => {
    const on = (e: Event) => setColor(String((e as CustomEvent).detail));
    window.addEventListener(COLOR_EVENT, on);
    return () => window.removeEventListener(COLOR_EVENT, on);
  }, []);
  return [
    color,
    (k: string) => {
      setColor(k);
      selectColor(k);
    },
  ];
}

/** Reveals [data-reveal] elements as they scroll into view. Content is visible without JS. */
export function RevealController() {
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) return;
    root.classList.add("motion");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}

/** Mobile sticky order bar. Hidden while the hero CTA or the order form is on screen. */
export function StickyOrder({ price, open }: { price: string; open: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("hero-cta");
    const form = document.getElementById("order");
    if (!hero || !form || !("IntersectionObserver" in window)) return;
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target, e.isIntersecting);
      setShow(!seen.get(hero) && !seen.get(form));
    });
    io.observe(hero);
    io.observe(form);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`sticky-order${show ? " show" : ""}`} aria-hidden={!show}>
      <div className="sticky-price">
        <span className="sticky-label">الدفع عند الاستلام</span>
        <strong>{price}</strong>
      </div>
      <a className="btn btn-primary" href="#order" tabIndex={show ? 0 : -1}>
        {open ? "اطلب الآن" : "تواصل معنا"}
      </a>
    </div>
  );
}

type Swatch = { key: string; label: string; available: boolean };

/** Color picker in the gallery: swaps the lifestyle photo and pre-selects the color in the form. */
export function ColorShowcase({
  colors,
  photos,
}: {
  colors: Swatch[];
  photos: Record<string, React.ReactNode>;
}) {
  const first = colors.find((c) => c.available)?.key ?? colors[0]?.key ?? "black";
  const [color, setColor] = useSelectedColor(first);
  return (
    <div className="showcase">
      <div className="showcase-stage" data-color={color}>
        {colors.map((c) => (
          <div key={c.key} className={`showcase-photo${c.key === color ? " active" : ""}`} aria-hidden={c.key !== color}>
            {photos[c.key]}
          </div>
        ))}
      </div>
      <div className="swatches" role="radiogroup" aria-label="اختر اللون لعرض صورته">
        {colors.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={c.key === color}
            className={`swatch swatch-${c.key}`}
            onClick={() => setColor(c.key)}
          >
            <span className="dot" aria-hidden />
            {c.label}
            {!c.available && <span className="swatch-note"> (غير متوفر حالياً)</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
