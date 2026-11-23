"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem", hour: "numeric", hour12: false }));
  if (h >= 5 && h < 12) return "صباح الخير";
  if (h >= 12 && h < 18) return "مساء الخير";
  return "مساء النور";
}

/** One-time welcome after signing in: 3D logo, greeting and today's summary. */
export function Welcome({ storeName, newCount, todayCount }: { storeName: string; newCount: number; todayCount: number }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");
  const [hello, setHello] = useState("أهلاً بك");

  useEffect(() => {
    setHello(greeting());
    router.replace("/admin", { scroll: false }); // drop ?welcome=1 so a reload doesn't replay it
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t1 = setTimeout(() => setPhase("out"), reduce ? 1200 : 2600);
    const t2 = setTimeout(() => setPhase("gone"), reduce ? 1300 : 3300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [router]);

  if (phase === "gone") return null;
  return (
    <div className={`welcome welcome-${phase}`} role="status" onClick={() => setPhase("out")}>
      <div className="welcome-cube" aria-hidden>
        <span className="wf wf-1">P</span>
        <span className="wf wf-2">MAX</span>
        <span className="wf wf-3">7×1</span>
        <span className="wf wf-4">P</span>
      </div>
      <p className="welcome-hi">{hello} 👋</p>
      <h2 className="welcome-title">
        أهلاً بك في لوحة تحكم <span dir="ltr">{storeName}</span>
      </h2>
      <p className="welcome-sub">
        {newCount > 0 ? `لديك ${newCount} ${newCount === 1 ? "طلب جديد" : "طلبات جديدة"} بانتظار التأكيد` : "لا توجد طلبات جديدة بانتظارك"}
        {todayCount > 0 ? ` · ${todayCount} اليوم` : ""}
      </p>
      <span className="welcome-bar" aria-hidden />
    </div>
  );
}
