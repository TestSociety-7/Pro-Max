import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getOrder } from "@/lib/db";
import { ORDER_STATUSES, STATUS_LABEL, formatMoney } from "@/lib/content";
import { f } from "@/app/admin/fieldProps";
import { AdminForm, Field } from "../../../AdminForm";
import { removeOrderAndBack, setOrderStatus } from "../../../actions";
import { ConfirmDelete } from "../../../ConfirmDelete";
import { IcArrow, IcPhone } from "../../../icons";
import { fmtDate } from "../../../fmt";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) notFound();
  const o = await getOrder(n);
  if (!o) notFound();
  const m = (c: number) => formatMoney(c, o.currency);
  const wa = o.phone.replace(/[^\d]/g, "");
  const step = ORDER_STATUSES.indexOf(o.status);

  return (
    <>
      <Link href="/admin" className="back">
        <IcArrow /> كل الطلبات
      </Link>
      <div className="page-head">
        <div>
          <p className="eyebrow">طلب {o.ref}</p>
          <h1 dir="auto">{o.customerName}</h1>
        </div>
        <span className={`badge badge-lg badge-${o.status}`}>{STATUS_LABEL[o.status]}</span>
      </div>

      {o.status !== "cancelled" && (
        <ol className="timeline" aria-label="مراحل الطلب">
          {ORDER_STATUSES.filter((s) => s !== "cancelled").map((s, i) => (
            <li key={s} className={i <= step ? "done" : ""} aria-current={i === step ? "step" : undefined}>
              <span className="tl-dot" aria-hidden />
              {STATUS_LABEL[s]}
            </li>
          ))}
        </ol>
      )}

      <div className="quick-actions">
        <a href={`tel:${o.phone}`} className="a-btn a-btn-primary">
          <IcPhone /> اتصال
        </a>
        {wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="a-btn a-btn-wa">
            واتساب
          </a>
        )}
      </div>

      <div className="detail-grid">
        <section className="card">
          <h2>العميل</h2>
          <dl className="dl">
            <dt>الاسم</dt>
            <dd dir="auto">{o.customerName}</dd>
            <dt>الهاتف</dt>
            <dd dir="ltr" className="ltr-cell">
              <a href={`tel:${o.phone}`}>{o.phone}</a>
            </dd>
            <dt>العنوان</dt>
            <dd dir="auto">{o.address}</dd>
            <dt>المدينة / المنطقة</dt>
            <dd dir="auto">{o.area || "—"}</dd>
            <dt>ملاحظة التوصيل</dt>
            <dd dir="auto">{o.note || "—"}</dd>
          </dl>
        </section>

        <section className="card">
          <h2>تفاصيل الطلب</h2>
          <dl className="dl">
            <dt>التاريخ</dt>
            <dd>{fmtDate(o.createdAt, true)}</dd>
            <dt>المنتج</dt>
            <dd dir="auto">{o.productName}</dd>
            <dt>اللون</dt>
            <dd dir="auto">{o.color}</dd>
            <dt>الكمية</dt>
            <dd>{o.quantity}</dd>
            <dt>سعر القطعة</dt>
            <dd>{m(o.unitPriceCents)}</dd>
            <dt>التوصيل</dt>
            <dd>{o.deliveryFeeCents ? m(o.deliveryFeeCents) : "مجاني"}</dd>
            <dt>الدفع</dt>
            <dd>نقداً عند الاستلام</dd>
          </dl>
          <div className="total-line">
            <span>المبلغ المطلوب تحصيله</span>
            <strong>{m(o.totalCents)}</strong>
          </div>
        </section>

        <section className="card">
          <h2>تحديث الحالة</h2>
          <AdminForm action={setOrderStatus} submitLabel="حفظ الحالة">
            <input type="hidden" name="id" value={o.id} />
            <Field name="status" label="الحالة">
              <select {...f("status")} defaultValue={o.status}>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field name="adminNote" label="ملاحظة داخلية" hint="تظهر لك فقط، ولا يراها العميل.">
              <textarea {...f("adminNote")} rows={3} defaultValue={o.adminNote} maxLength={1000} dir="auto" />
            </Field>
          </AdminForm>
          <p className="a-hint">آخر تحديث: {fmtDate(o.statusUpdatedAt, true)}</p>
        </section>

        <section className="card danger-card">
          <h2>حذف الطلب</h2>
          <p className="a-hint">يُحذف الطلب نهائياً من لوحة التحكم.</p>
          <form action={removeOrderAndBack}>
            <input type="hidden" name="id" value={o.id} />
            <ConfirmDelete />
          </form>
        </section>
      </div>
    </>
  );
}
