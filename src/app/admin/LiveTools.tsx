"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  checkNewOrders,
  getPushKey,
  subscribePush,
  unsubscribePush,
  type NewOrderAlert,
} from "./actions";
import { IcBell, IcDownload } from "./icons";

const POLL_MS = 20_000;

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function chime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.25, now + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(now + i * 0.16);
      o.stop(now + i * 0.16 + 0.55);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* sound is a bonus */
  }
}

type PushState =
  | "unsupported"
  | "ios-install"
  | "off"
  | "on"
  | "denied"
  | "busy";

/**
 * Header tools: live new-order alerts (sound + toast + app badge while the panel is open),
 * phone notifications via Web Push, and the "install app" button.
 */
export function LiveTools() {
  const router = useRouter();
  const [toasts, setToasts] = useState<NewOrderAlert[]>([]);
  const [push, setPush] = useState<PushState>("busy");
  const [installEvt, setInstallEvt] = useState<
    (Event & { prompt: () => Promise<void> }) | null
  >(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const latest = useRef(0);
  const unseen = useRef(0);

  // ---- live polling -------------------------------------------------------
  const poll = useCallback(async () => {
    try {
      const r = await checkNewOrders(latest.current);
      if (latest.current && r.orders.length) {
        setToasts((t) => [...r.orders.reverse(), ...t].slice(0, 4));
        unseen.current += r.orders.length;
        (
          navigator as Navigator & {
            setAppBadge?: (n: number) => Promise<void>;
          }
        )
          .setAppBadge?.(unseen.current)
          .catch(() => {});
        chime();
        if ("vibrate" in navigator) navigator.vibrate?.([120, 60, 120]);
        router.refresh();
      }
      latest.current = r.latest;
    } catch {
      /* offline or signed out: try again next tick */
    }
  }, [router]);

  useEffect(() => {
    poll();
    const id = setInterval(
      () => document.visibilityState === "visible" && poll(),
      POLL_MS,
    );
    const onVis = () => {
      if (document.visibilityState === "visible") {
        unseen.current = 0;
        (navigator as Navigator & { clearAppBadge?: () => Promise<void> })
          .clearAppBadge?.()
          .catch(() => {});
        poll();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll]);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((x) => x.slice(0, -1)), 9000);
    return () => clearTimeout(t);
  }, [toasts]);

  // ---- service worker + push state ---------------------------------------
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setStandalone(isStandalone);
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    (async () => {
      if (!("serviceWorker" in navigator)) return setPush("unsupported");
      const reg = await navigator.serviceWorker
        .register("/sw.js", { scope: "/admin" })
        .catch(() => null);
      if (!reg || !("PushManager" in window) || !("Notification" in window)) {
        return setPush(ios && !isStandalone ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setPush("denied");
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        subscribePush(JSON.stringify(sub)).catch(() => {}); // keep the server copy fresh
        setPush("on");
      } else setPush("off");
    })();
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const togglePush = async () => {
    if (push === "ios-install" || push === "denied")
      return setShowIosHelp(true);
    if (push !== "on" && push !== "off") return;
    const prev = push;
    setPush("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (prev === "on" && existing) {
        await unsubscribePush(existing.endpoint);
        await existing.unsubscribe();
        return setPush("off");
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted")
        return setPush(perm === "denied" ? "denied" : "off");
      const key = await getPushKey();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64ToBytes(key),
        }));
      const ok = await subscribePush(JSON.stringify(sub));
      setPush(ok ? "on" : "off");
      if (ok) chime();
    } catch (err) {
      console.warn("push setup failed", err);
      setPush(prev);
    }
  };

  const install = async () => {
    if (installEvt) {
      await installEvt.prompt();
      setInstallEvt(null);
    } else setShowIosHelp(true);
  };

  const bellLabel: Record<PushState, string> = {
    on: "الإشعارات مفعّلة",
    off: "فعّل إشعارات الطلبات",
    busy: "جارٍ التحقق…",
    denied: "فعّل إشعارات الطلبات",
    unsupported: "الإشعارات غير مدعومة هنا",
    "ios-install": "ثبّت التطبيق لتفعيل الإشعارات",
  };

  return (
    <>
      <div className="live-tools">
        {!standalone && (
          <button type="button" className="tool-btn" onClick={install}>
            <IcDownload />
            <span>تثبيت التطبيق</span>
          </button>
        )}
        <button
          type="button"
          className={`tool-btn bell bell-${push}`}
          onClick={togglePush}
          disabled={push === "busy" || push === "unsupported"}
          aria-pressed={push === "on"}
          title={bellLabel[push]}
        >
          <IcBell />
          <span>{bellLabel[push]}</span>
          <i className="bell-dot" aria-hidden />
        </button>
      </div>

      {mounted &&
        createPortal(
          <>
            <div className="toasts" aria-live="polite">
              {toasts.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/orders/${t.id}`}
                  className="toast"
                  onClick={() =>
                    setToasts((x) => x.filter((y) => y.id !== t.id))
                  }
                >
                  <span className="toast-pulse" aria-hidden />
                  <span className="toast-body">
                    <strong>طلب جديد · {t.ref}</strong>
                    <span>
                      {t.name} · {t.summary}
                    </span>
                  </span>
                </Link>
              ))}
            </div>

            {showIosHelp && (
              <div
                className="sheet-backdrop"
                onClick={() => setShowIosHelp(false)}
              >
                <div
                  className="sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="ios-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 id="ios-title">ثبّت لوحة التحكم على هاتفك</h2>
                  <ol>
                    <li>
                      <strong>آيفون (Safari):</strong> اضغط زر المشاركة{" "}
                      <span aria-hidden>⎋</span> ثم «إضافة إلى الشاشة الرئيسية».
                    </li>
                    <li>
                      <strong>أندرويد (Chrome):</strong> افتح القائمة ⋮ ثم
                      «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».
                    </li>
                    <li>
                      افتح التطبيق من الشاشة الرئيسية، ثم اضغط زر الجرس لتفعيل
                      إشعارات الطلبات.
                    </li>
                  </ol>
                  <p className="a-hint">
                    على آيفون تعمل الإشعارات فقط بعد تثبيت التطبيق (iOS 16.4 أو
                    أحدث).
                  </p>
                  {push === "denied" && (
                    <p className="a-hint">
                      إذا سبق ورفضت الإشعارات: افتح إعدادات الموقع في المتصفح
                      واسمح بالإشعارات، ثم أعد فتح لوحة التحكم.
                    </p>
                  )}
                  <button
                    type="button"
                    className="a-btn a-btn-primary"
                    onClick={() => setShowIosHelp(false)}
                  >
                    فهمت
                  </button>
                </div>
              </div>
            )}
          </>,
          document.body,
        )}
    </>
  );
}

/** Animated number for dashboard stats. */
export function CountUp({
  value,
  format = "plain",
}: {
  value: number;
  format?: "plain";
}) {
  const [n, setN] = useState(value);
  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      value === 0
    )
      return setN(value);
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    setN(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format === "plain" ? n.toLocaleString("en") : n}</>;
}

/** Pointer-driven 3D tilt for cards (desktop only; respects reduced motion). */
export function Tilt({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (
      !el ||
      window.matchMedia("(prefers-reduced-motion: reduce), (hover: none)")
        .matches
    )
      return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--rx", `${(-y * 8).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(x * 10).toFixed(2)}deg`);
      el.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(1)}%`);
    };
    const leave = () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);
  return (
    <div ref={ref} className={`tilt ${className ?? ""}`}>
      {children}
    </div>
  );
}
