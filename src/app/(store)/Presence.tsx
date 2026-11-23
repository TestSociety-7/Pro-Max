"use client";

import { useEffect } from "react";

const BEAT_MS = 25_000;

function visitorId(): string {
  const make = () => {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  };
  try {
    let id = sessionStorage.getItem("pm_vid");
    if (!id) {
      id = make();
      sessionStorage.setItem("pm_vid", id);
    }
    return id;
  } catch {
    return make();
  }
}

/** Anonymous heartbeat so the admin sees how many people are on the site now. No personal data. */
export function Presence() {
  useEffect(() => {
    if (/bot|crawl|spider|lighthouse|headless/i.test(navigator.userAgent) && !navigator.userAgent.includes("PMTest")) return;
    const id = visitorId();
    const where = () => {
      const order = document.getElementById("order");
      if (!order) return "home";
      const r = order.getBoundingClientRect();
      return r.top < innerHeight * 0.6 && r.bottom > 0 ? "order" : "home";
    };
    const send = (bye = false) => {
      const body = JSON.stringify({ id, path: where(), bye });
      if (bye && navigator.sendBeacon) {
        navigator.sendBeacon("/api/presence", new Blob([body], { type: "application/json" }));
        return;
      }
      fetch("/api/presence", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    };
    send();
    // tell the admin straight away when someone reaches the order form
    let last = where();
    const order = document.getElementById("order");
    const io = order
      ? new IntersectionObserver(() => {
          const now = where();
          if (now !== last) {
            last = now;
            send();
          }
        }, { threshold: [0, 0.2, 0.5] })
      : null;
    if (order) io?.observe(order);
    const t = setInterval(() => document.visibilityState === "visible" && send(), BEAT_MS);
    const onVis = () => (document.visibilityState === "visible" ? send() : send(true));
    const onHide = () => send(true);
    document.addEventListener("visibilitychange", onVis);
    addEventListener("pagehide", onHide);
    return () => {
      clearInterval(t);
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      removeEventListener("pagehide", onHide);
    };
  }, []);
  return null;
}
