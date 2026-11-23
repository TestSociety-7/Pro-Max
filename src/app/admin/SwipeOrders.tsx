"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { removeOrders } from "./actions";
import { IcPhone, IcTrash } from "./icons";

export type OrderRow = {
  id: number;
  ref: string;
  name: string;
  meta: string;
  area: string;
  item: string;
  total: string;
  status: string;
  statusLabel: string;
  phone: string;
};

const UNDO_MS = 5000;
const THRESHOLD = 0.38; // share of the row width to swipe before it deletes

/** Order cards: swipe sideways (touch or mouse) to delete, with an undo bar. */
export function SwipeOrders({ rows }: { rows: OrderRow[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<OrderRow[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<OrderRow[]>([]);
  pendingRef.current = pending;

  const commit = async () => {
    const ids = pendingRef.current.map((r) => r.id);
    setPending([]);
    if (!ids.length) return;
    try {
      await removeOrders(ids);
    } finally {
      router.refresh();
    }
  };

  // finish a pending delete if the admin leaves the page
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      const ids = pendingRef.current.map((r) => r.id);
      if (ids.length) removeOrders(ids).catch(() => {});
    },
    [],
  );

  const remove = (row: OrderRow) => {
    setHidden((h) => new Set(h).add(row.id));
    setPending((p) => [...p, row]);
    if (navigator.vibrate) navigator.vibrate(18);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(commit, UNDO_MS);
  };

  const undo = () => {
    if (timer.current) clearTimeout(timer.current);
    setHidden((h) => {
      const n = new Set(h);
      pending.forEach((r) => n.delete(r.id));
      return n;
    });
    setPending([]);
  };

  const visible = rows.filter((r) => !hidden.has(r.id));

  return (
    <>
      <p className="swipe-hint">اسحب الطلب جانباً لحذفه</p>
      <ul className="order-list">
        {visible.map((o, i) => (
          <SwipeRow key={o.id} row={o} index={i} onDelete={() => remove(o)} />
        ))}
      </ul>
      {visible.length === 0 && rows.length > 0 && (
        <div className="empty">
          <h2>تم حذف الطلبات</h2>
        </div>
      )}
      {pending.length > 0 && (
        <div className="undo-bar" role="status">
          <span className="undo-timer" aria-hidden />
          <span>{pending.length === 1 ? `تم حذف الطلب ${pending[0].ref}` : `تم حذف ${pending.length} طلبات`}</span>
          <button type="button" onClick={undo}>
            تراجع
          </button>
        </div>
      )}
    </>
  );
}

function SwipeRow({ row: o, index, onDelete }: { row: OrderRow; index: number; onDelete: () => void }) {
  const li = useRef<HTMLLIElement>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const dx = useRef(0);
  const horizontal = useRef<boolean | null>(null);
  const moved = useRef(false);
  const [leaving, setLeaving] = useState<0 | 1 | -1>(0);

  const setX = (x: number) => {
    const el = li.current;
    if (!el) return;
    const w = el.offsetWidth || 1;
    el.style.setProperty("--x", `${x}px`);
    el.style.setProperty("--k", Math.min(1, Math.abs(x) / (w * THRESHOLD)).toFixed(3));
    el.dataset.dir = x < 0 ? "l" : "r";
  };

  const end = () => {
    const el = li.current;
    if (!el || !start.current) return;
    start.current = null;
    el.classList.remove("dragging");
    const w = el.offsetWidth || 1;
    if (Math.abs(dx.current) > w * THRESHOLD) {
      setLeaving(dx.current < 0 ? -1 : 1);
      setTimeout(onDelete, 360);
    } else setX(0);
    dx.current = 0;
  };

  return (
    <li
      ref={li}
      className={`swipe-row${leaving ? " leaving" : ""}`}
      data-leave={leaving}
      style={{ ["--i" as string]: Math.min(index, 12) }}
      onPointerDown={(e) => {
        if (e.button !== 0 || (e.target as HTMLElement).closest(".o-call, .o-del")) return;
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        horizontal.current = null;
        moved.current = false;
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        const x = e.clientX - s.x;
        const y = e.clientY - s.y;
        if (horizontal.current === null && (Math.abs(x) > 8 || Math.abs(y) > 8)) {
          horizontal.current = Math.abs(x) > Math.abs(y);
          if (horizontal.current) {
            li.current?.setPointerCapture(e.pointerId);
            li.current?.classList.add("dragging");
          } else start.current = null; // vertical: let the page scroll
        }
        if (!horizontal.current) return;
        moved.current = true;
        dx.current = x;
        setX(x);
      }}
      onPointerUp={end}
      onPointerCancel={() => {
        start.current = null;
        li.current?.classList.remove("dragging");
        setX(0);
      }}
      onClickCapture={(e) => {
        // a swipe is not a tap: don't open the order
        if (moved.current) {
          e.preventDefault();
          e.stopPropagation();
          moved.current = false;
        }
      }}
    >
      <div className="swipe-under" aria-hidden>
        <span className="swipe-bin">
          <IcTrash />
          حذف
        </span>
      </div>
      <div className="swipe-card">
        <Link href={`/admin/orders/${o.id}`} className="order-row" draggable={false}>
          <span className="o-main">
            <span className="o-name" dir="auto">
              {o.name}
            </span>
            <span className="o-meta">
              <span className="o-ref">{o.ref}</span> · {o.meta}
              {o.area ? (
                <>
                  {" "}
                  · <span dir="auto">{o.area}</span>
                </>
              ) : null}
            </span>
          </span>
          <span className="o-item" dir="auto">
            {o.item}
          </span>
          <span className="o-total">{o.total}</span>
          <span className={`badge badge-${o.status}`}>{o.statusLabel}</span>
        </Link>
        <a href={`tel:${o.phone}`} className="o-call" aria-label={`اتصل بـ ${o.name}`}>
          <IcPhone />
        </a>
        <button type="button" className="o-del" aria-label={`حذف الطلب ${o.ref}`} onClick={() => {
            setLeaving(-1);
            setTimeout(onDelete, 360);
          }}>
          <IcTrash />
        </button>
      </div>
    </li>
  );
}
