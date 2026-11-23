"use client";

import { useEffect, useState } from "react";
import { liveVisitors } from "./actions";

const POLL_MS = 10_000;

/** "Who is on the store right now" pill for the dashboard. */
export function LiveVisitors() {
  const [v, setV] = useState<{ total: number; ordering: number } | null>(null);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await liveVisitors();
        if (!alive) return;
        setV((old) => {
          if (old && old.total !== r.total) setBump((b) => b + 1);
          return r;
        });
      } catch {
        /* signed out or offline */
      }
    };
    tick();
    const id = setInterval(() => document.visibilityState === "visible" && tick(), POLL_MS);
    const onVis = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const n = v?.total ?? 0;
  return (
    <div className={`live-visitors${n > 0 ? " is-live" : ""}`} role="status" aria-live="polite">
      <span className="lv-dot" aria-hidden>
        <i />
      </span>
      <span className="lv-label">على الموقع الآن</span>
      <strong key={bump} className="lv-num">
        {v ? n : "…"}
      </strong>
      <span className="lv-unit">{n === 1 ? "زائر" : "زوار"}</span>
      {v && v.ordering > 0 && <span className="lv-ordering">{v.ordering} في نموذج الطلب</span>}
    </div>
  );
}
