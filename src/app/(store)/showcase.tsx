"use client";

import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Spotlight: a tall scroll section where the product turns in 3D and  */
/* the camera "zooms" to each feature, with callouts appearing.        */
/* ------------------------------------------------------------------ */

export type Callout = { title: string; text: string; x: number; y: number; zoom: number };

const CALLOUTS: Callout[] = [
  { title: "فتحة تغذية واسعة", text: "لإدخال الخضار بسهولة وبسرعة.", x: 58, y: 10, zoom: 1.55 },
  { title: "غطاء شفاف وقفل أمان", text: "ترى الخضار أثناء التقطيع، مع قفل للحماية.", x: 30, y: 30, zoom: 1.4 },
  { title: "مفتاح تحكم سهل", text: "تحكم بسيط بلمسة واحدة.", x: 48, y: 70, zoom: 1.6 },
  { title: "قاعدة ثابتة", text: "أرجل مطاطية مانعة للانزلاق على الرخام.", x: 50, y: 95, zoom: 1.3 },
];

export function Spotlight({
  src,
  alt,
  callouts = CALLOUTS,
  eyebrow = "من قريب",
  title = "كل تفصيلة مصمّمة لمطبخك.",
  wide = false,
}: {
  src: string;
  alt: string;
  callouts?: Callout[];
  eyebrow?: string;
  title?: string;
  /** landscape product (the drying rack) */
  wide?: boolean;
}) {
  const CALLOUTS_ = callouts;
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(-1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
      el.style.setProperty("--p", p.toFixed(4));
      // which callout is active (first 8% is the intro turn)
      const s = p < 0.08 ? -1 : Math.min(CALLOUTS_.length - 1, Math.floor(((p - 0.08) / 0.92) * CALLOUTS_.length));
      setStep(s);
      if (reduce) return;
      const c = s >= 0 ? CALLOUTS_[s] : null;
      const narrow = window.innerWidth < 960;
      el.style.setProperty("--zoom", String(c ? (narrow ? 1 + (c.zoom - 1) * 0.55 : c.zoom) : 1));
      el.style.setProperty("--ox", `${c ? c.x : 50}%`);
      el.style.setProperty("--oy", `${c ? c.y : 50}%`);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className={`spotlight${wide ? " spot-wide" : ""}`} ref={ref} aria-labelledby="spot-title">
      <div className="spot-sticky">
        <div className="spot-head">
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="spot-title">{title}</h2>
        </div>
        <div className="spot-stage">
          <div className="spot-glow" aria-hidden />
          <div className="spot-product">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} width={wide ? 1400 : 776} height={wide ? 898 : 1400} loading="lazy" decoding="async" />
            {CALLOUTS_.map((c, i) => (
              <span
                key={c.title}
                className={`spot-pin${i === step ? " on" : ""}`}
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
                aria-hidden
              />
            ))}
          </div>
          <div className="spot-floor" aria-hidden />
        </div>
        <ol className="spot-callouts">
          {CALLOUTS_.map((c, i) => (
            <li key={c.title} className={i === step ? "on" : i < step ? "past" : ""}>
              <span className="spot-num">{String(i + 1).padStart(2, "0")}</span>
              <strong>{c.title}</strong>
              <span>{c.text}</span>
            </li>
          ))}
        </ol>
        <div className="spot-progress" aria-hidden>
          <span />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Disc ring: the real blade discs (cut out of the owner's photo) on a */
/* 3D carousel the customer can spin by dragging or tapping.           */
/* ------------------------------------------------------------------ */

const PARTS = [
  { src: "/product/parts/d1.webp", label: "قرص الشرائح", w: 233, h: 178 },
  { src: "/product/parts/d2.webp", label: "قرص البشر", w: 230, h: 185 },
  { src: "/product/parts/d3.webp", label: "قرص الجوليان", w: 228, h: 173 },
  { src: "/product/parts/d4.webp", label: "قرص التقطيع", w: 226, h: 182 },
  { src: "/product/parts/grid.webp", label: "شبكة التقطيع", w: 131, h: 138 },
];

export function DiscRing() {
  const ringRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const angle = useRef(0);
  const target = useRef<number | null>(null);
  const drag = useRef<{ x: number; a: number } | null>(null);
  const step = 360 / PARTS.length;

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = false;
    let last = performance.now();
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });
    io.observe(ring);
    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (target.current !== null) {
        const d = target.current - angle.current;
        angle.current += d * Math.min(1, dt * 6);
        if (Math.abs(d) < 0.05) target.current = null;
      } else if (!drag.current && !reduce) {
        angle.current -= dt * 14;
      }
      // billboarded cards on an ellipse: always face the viewer, depth from position
      const cards = ring.children as HTMLCollectionOf<HTMLElement>;
      const R = Math.min(ring.clientWidth * 0.34, 260);
      for (let i = 0; i < cards.length; i++) {
        const t = ((i * step + angle.current) * Math.PI) / 180;
        const x = Math.sin(t) * R;
        const z = Math.cos(t) * R;
        const y = -Math.cos(t) * R * 0.08;
        const front = (Math.cos(t) + 1) / 2;
        cards[i].style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${(Math.sin(t) * -18).toFixed(1)}deg)`;
        cards[i].style.zIndex = String(Math.round(front * 100));
        cards[i].style.opacity = String(0.35 + front * 0.65);
      }
      const idx = ((Math.round(-angle.current / step) % PARTS.length) + PARTS.length) % PARTS.length;
      setActive((p) => (p === idx ? p : idx));
      if (visible) raf = requestAnimationFrame(tick);
    };
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [step]);

  const goTo = (i: number) => {
    const cur = angle.current;
    const base = -i * step;
    const k = Math.round((cur - base) / 360);
    target.current = base + k * 360;
  };

  return (
    <section className="discs" aria-labelledby="discs-title">
      <div className="discs-head" data-reveal>
        <p className="eyebrow">داخل العلبة</p>
        <h2 id="discs-title">4 أقراص وشبكة تقطيع.</h2>
        <p className="discs-text">صور حقيقية للأقراص المرفقة. اسحب لتدويرها أو اختر قرصاً.</p>
      </div>
      <div
        className="disc-scene"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, a: angle.current };
          target.current = null;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          angle.current = drag.current.a - (e.clientX - drag.current.x) * 0.35;
        }}
        onPointerUp={() => {
          if (drag.current) goTo(Math.round(-angle.current / step));
          drag.current = null;
        }}
        onPointerCancel={() => (drag.current = null)}
      >
        <div className="disc-ring" ref={ringRef} style={{ ["--n" as string]: PARTS.length }}>
          {PARTS.map((p, i) => (
            <figure key={p.src} className={`disc-card${i === active ? " on" : ""}`} style={{ ["--i" as string]: i }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.src}
                srcSet={`${p.src} 1x, ${p.src.replace(".webp", "@2x.webp")} 2x`}
                alt={p.label}
                width={p.w}
                height={p.h}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </figure>
          ))}
        </div>
        <div className="disc-floor" aria-hidden />
      </div>
      <div className="disc-tabs" role="tablist" aria-label="الأقراص">
        {PARTS.map((p, i) => (
          <button key={p.src} type="button" role="tab" aria-selected={i === active} onClick={() => goTo(i)}>
            {p.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Order celebration: 3D confetti of salad slices when an order lands. */
/* ------------------------------------------------------------------ */

type Bit = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  vr: number;
  r: number;
  kind: number;
};

const COLORS = [
  ["#7cc16b", "#d9f2c4"], // cucumber
  ["#f28c28", "#ffc58a"], // carrot
  ["#e3402d", "#ff9b85"], // tomato
  ["#9b4fb0", "#e7c4f0"], // red onion
  ["#f26722", "#ffd2b8"], // brand
];

export function Celebration({ run }: { run: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!run) return;
    const cv = ref.current;
    if (!cv || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.scale(dpr, dpr);
    const bits: Bit[] = Array.from({ length: 140 }, () => {
      const a = Math.random() * Math.PI * 2;
      const sp = 6 + Math.random() * 10;
      return {
        x: 0,
        y: 0,
        z: Math.random() * 200 - 100,
        vx: Math.cos(a) * sp,
        vy: -Math.abs(Math.sin(a)) * sp - 6,
        vz: (Math.random() - 0.5) * 12,
        rx: Math.random() * 6,
        ry: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.4,
        r: 7 + Math.random() * 9,
        kind: Math.floor(Math.random() * COLORS.length),
      };
    });
    const cx = W / 2;
    const cy = H * 0.42;
    const f = 600;
    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, W, H);
      bits.sort((a, b) => b.z - a.z);
      for (const b of bits) {
        b.vy += 0.38;
        b.vx *= 0.985;
        b.vz *= 0.985;
        b.x += b.vx;
        b.y += b.vy;
        b.z += b.vz;
        b.rx += b.vr;
        b.ry += b.vr * 1.3;
        const s = f / (f + b.z);
        const px = cx + b.x * s * 1.6;
        const py = cy + b.y * s;
        const [c1, c2] = COLORS[b.kind];
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(b.rx);
        ctx.scale(1, Math.abs(Math.cos(b.ry)) * 0.9 + 0.1); // the tumbling, 3D flip
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 2.2) / 1.2);
        const r = b.r * s;
        if (b.kind === 4) {
          ctx.fillStyle = c1;
          ctx.fillRect(-r, -r / 3, r * 2, r / 1.5);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = c1;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
          ctx.fillStyle = c2;
          ctx.fill();
          if (b.kind === 0 || b.kind === 2) {
            ctx.fillStyle = c1;
            for (let k = 0; k < 5; k++) {
              const a = (k / 5) * Math.PI * 2;
              ctx.beginPath();
              ctx.arc(Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38, r * 0.08, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        ctx.restore();
      }
      if (t < 3.6) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [run]);
  return <canvas ref={ref} className="celebrate" aria-hidden />;
}
