"use client";

import { useState } from "react";
import type { Offer } from "@/lib/content";
import { AdminForm } from "./AdminForm";
import { updateOffers } from "./actions";
import { IcTrash } from "./icons";

const blank = (): Offer => ({
  id: `o${Math.random().toString(36).slice(2, 8)}`,
  title: "",
  quantity: 2,
  price: 0,
  includesDelivery: true,
  badge: "",
  active: true,
  theme: "standard",
  endsAt: "",
});

export function OffersEditor({ initial, unitPrice }: { initial: Offer[]; unitPrice: number }) {
  const [offers, setOffers] = useState<Offer[]>(initial);
  const set = (i: number, patch: Partial<Offer>) => setOffers((list) => list.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  return (
    <AdminForm action={updateOffers} submitLabel="حفظ العروض" className="admin-form wide">
      <input type="hidden" name="offers" value={JSON.stringify(offers)} />
      {offers.length === 0 && (
        <div className="card offer-empty">
          <p>لا توجد عروض بعد. أضف عرضك الأول ليظهر في المتجر.</p>
        </div>
      )}
      {offers.map((o, i) => {
        const normal = unitPrice * o.quantity;
        const saving = normal > 0 && o.price > 0 ? normal - o.price : 0;
        return (
          <fieldset key={o.id} className={`card offer-card${o.active ? " is-on" : ""}`}>
            <legend>
              عرض {i + 1}
              <span className={`offer-state ${o.active ? "on" : "off"}`}>{o.active ? "مفعّل" : "متوقف"}</span>
            </legend>
            <div className="grid-2">
              <label className="a-field">
                <span className="a-label">اسم العرض</span>
                <input value={o.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="مثال: عرض القطعتين" dir="auto" maxLength={60} />
              </label>
              <label className="a-field">
                <span className="a-label">شارة صغيرة (اختياري)</span>
                <input value={o.badge} onChange={(e) => set(i, { badge: e.target.value })} placeholder="مثال: الأكثر طلباً" dir="auto" maxLength={30} />
              </label>
            </div>
            <div className="grid-3">
              <label className="a-field">
                <span className="a-label">عدد القطع في العرض</span>
                <input inputMode="numeric" value={o.quantity} onChange={(e) => set(i, { quantity: Math.min(10, Math.max(1, parseInt(e.target.value.replace(/\D/g, ""), 10) || 1)) })} />
              </label>
              <label className="a-field">
                <span className="a-label">سعر العرض كاملاً (₪)</span>
                <input inputMode="decimal" value={o.price || ""} placeholder="270" onChange={(e) => set(i, { price: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} />
              </label>
              <div className="a-field">
                <span className="a-label">التوصيل</span>
                <label className="check">
                  <input type="checkbox" checked={o.includesDelivery} onChange={(e) => set(i, { includesDelivery: e.target.checked })} /> شامل التوصيل
                </label>
              </div>
            </div>
            <div className="grid-2">
              <div className="a-field">
                <span className="a-label">تصميم العرض</span>
                <div className="theme-pick">
                  <label className={o.theme === "standard" ? "on" : ""}>
                    <input type="radio" name={`theme-${o.id}`} checked={o.theme === "standard"} onChange={() => set(i, { theme: "standard" })} />
                    عادي
                  </label>
                  <label className={`bf${o.theme === "blackfriday" ? " on" : ""}`}>
                    <input type="radio" name={`theme-${o.id}`} checked={o.theme === "blackfriday"} onChange={() => set(i, { theme: "blackfriday" })} />
                    BLACK FRIDAY
                  </label>
                </div>
              </div>
              <label className="a-field">
                <span className="a-label">ينتهي في (اختياري)</span>
                <input type="date" value={o.endsAt} onChange={(e) => set(i, { endsAt: e.target.value })} dir="ltr" />
                <span className="a-hint">يظهر عدّاد تنازلي، ويختفي العرض تلقائياً بعد هذا اليوم.</span>
              </label>
            </div>
            {saving > 0 && <p className="offer-saving">يوفّر الزبون {saving} ₪ مقارنة بشراء {o.quantity === 1 ? "قطعة واحدة" : `${o.quantity} قطع`} بالسعر العادي{o.includesDelivery ? "، والتوصيل مجاني" : ""}.</p>}
            <div className="offer-actions">
              <label className="switch">
                <input type="checkbox" checked={o.active} onChange={(e) => set(i, { active: e.target.checked })} />
                <span aria-hidden />
                إظهار العرض في المتجر
              </label>
              <button type="button" className="a-btn a-btn-danger" onClick={() => setOffers((l) => l.filter((_, j) => j !== i))}>
                <IcTrash /> حذف العرض
              </button>
            </div>
          </fieldset>
        );
      })}
      {offers.length < 6 && (
        <button type="button" className="a-btn offer-add" onClick={() => setOffers((l) => [...l, blank()])}>
          + إضافة عرض جديد
        </button>
      )}
    </AdminForm>
  );
}
