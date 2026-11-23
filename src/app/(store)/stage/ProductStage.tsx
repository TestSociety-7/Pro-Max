"use client";

import { useEffect, useRef, useState } from "react";
import { selectColor } from "../client";
import type { StageHandle } from "./scene";

// Cut-out photos of the two units (owner's photos, background removed).
const CUTS: Record<string, { src: string; srcHi: string; aspect: number }> = {
  black: { src: "/product/cut-black-700.webp", srcHi: "/product/cut-black.webp", aspect: 776 / 1400 },
  beige: { src: "/product/cut-beige-700.webp", srcHi: "/product/cut-beige.webp", aspect: 809 / 1400 },
};

type Swatch = { key: string; label: string; available: boolean };

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Hero stage. Always renders a static poster first (fast, works without JS or
 * WebGL, and is what reduced-motion users keep). When the browser can, the
 * real-time 3D turntable loads on top of it.
 */
export function ProductStage({ colors, accent, name }: { colors: Swatch[]; accent: string; name: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const handle = useRef<StageHandle | null>(null);
  const [live, setLive] = useState(false);
  const [active, setActive] = useState(colors[0]?.key ?? "black");

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduce || saveData || !webglAvailable()) return;

    let disposed = false;
    const hi = window.devicePixelRatio * el.clientHeight > 1100;
    const stageColors = colors
      .filter((c) => CUTS[c.key])
      .map((c) => ({ key: c.key, src: hi ? CUTS[c.key].srcHi : CUTS[c.key].src, aspect: CUTS[c.key].aspect }));

    import("./scene")
      .then(({ createStage }) =>
        createStage({ canvas: cv, container: el, colors: stageColors, accent, onReady: () => !disposed && setLive(true) }),
      )
      .then((h) => {
        if (disposed) h.dispose();
        else handle.current = h;
      })
      .catch((err) => console.warn("3D stage unavailable, showing photo instead.", err));

    const onScroll = () => {
      const r = el.getBoundingClientRect();
      handle.current?.setScrollProgress(-r.top / Math.max(1, r.height));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const onColor = (e: Event) => {
      const k = String((e as CustomEvent).detail);
      setActive(k);
      handle.current?.focus(k);
    };
    window.addEventListener("promax:color", onColor);

    return () => {
      disposed = true;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("promax:color", onColor);
      handle.current?.dispose();
      handle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`stage${live ? " is-live" : ""}`} ref={wrap}>
      <div className="stage-poster" aria-hidden={live}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="poster-back" src={CUTS.beige.src} alt="" width={404} height={700} fetchPriority="high" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="poster-front"
          src={CUTS.black.src}
          alt={`${name} باللونين الأسود والبيج`}
          width={388}
          height={700}
          fetchPriority="high"
        />
      </div>
      <canvas ref={canvas} className="stage-canvas" aria-hidden="true" />
      <div className="stage-ui">
        <div className="stage-swatches" role="radiogroup" aria-label="اختر اللون">
          {colors.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={active === c.key}
              className={`stage-swatch swatch-${c.key}`}
              onClick={() => selectColor(c.key)}
            >
              <span className="dot" aria-hidden />
              {c.label}
            </button>
          ))}
        </div>
        {live && <p className="stage-hint">اسحب لتدوير المنصّة</p>}
      </div>
    </div>
  );
}
