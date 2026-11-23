import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getProduct, getSettings, listOrders } from "@/lib/db";
import { ORDER_STATUSES, STATUS_LABEL, formatMoney, isStatus, isValidCurrency } from "@/lib/content";
import { CountUp, Tilt } from "../LiveTools";
import { IcPhone, IcSearch } from "../icons";
import { dayKey, fmtDate } from "../fmt";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = isStatus(sp.status) ? sp.status : "all";
  const q = (sp.q ?? "").slice(0, 80);

  let data;
  try {
    const [all, orders, product, settings] = await Promise.all([
      listOrders({ limit: 500 }),
      listOrders({ status, q }),
      getProduct(),
      getSettings(),
    ]);
    data = { all, orders, product, settings };
  } catch (err) {
    console.error("admin orders", err);
    return (
      <div className="soft-card">
        <h1>تعذّر تحميل الطلبات</h1>
        <p>أعد تحميل الصفحة بعد قليل.</p>
      </div>
    );
  }
  const { all, orders, product, settings } = data;
  const counts: Record<string, number> = {};
  for (const o of all) counts[o.status] = (counts[o.status] ?? 0) + 1;
  const today = dayKey(new Date());
  const todayCount = all.filter((o) => dayKey(o.createdAt) === today).length;
  const open = all.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
  const toCollect = open.reduce((s, o) => s + o.totalCents, 0);
  const delivered = all.filter((o) => o.status === "delivered").reduce((s, o) => s + o.totalCents, 0);
  const cur = settings.currencyCode;
  const money = (c: number) => (isValidCurrency(cur) ? formatMoney(c, cur) : String(c / 100));
  const orderingClosed = !(product.price > 0 && isValidCurrency(cur));

  const tab = (s: string) => {
    const params = new URLSearchParams();
    if (s !== "all") params.set("status", s);
    if (q) params.set("q", q);
    const qs = params.toString();
    return `/admin${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">نظرة عامة</p>
          <h1>الطلبات</h1>
        </div>
      </div>

      {orderingClosed && (
        <Link href="/admin/product" className="nudge">
          <span className="nudge-dot" aria-hidden />
          أضف سعر المنتج لفتح الطلبات في المتجر
          <span className="nudge-go" aria-hidden>
            ←
          </span>
        </Link>
      )}

      <section className="stats" aria-label="ملخص">
        <Tilt className="stat stat-hot">
          <span className="stat-label">طلبات جديدة</span>
          <span className="stat-value">
            <CountUp value={counts.new ?? 0} />
          </span>
          <span className="stat-foot">بانتظار التأكيد</span>
        </Tilt>
        <Tilt className="stat">
          <span className="stat-label">طلبات اليوم</span>
          <span className="stat-value">
            <CountUp value={todayCount} />
          </span>
          <span className="stat-foot">من أصل {all.length} طلب</span>
        </Tilt>
        <Tilt className="stat">
          <span className="stat-label">للتحصيل عند التسليم</span>
          <span className="stat-value stat-money">{money(toCollect)}</span>
          <span className="stat-foot">{open.length} طلب مفتوح</span>
        </Tilt>
        <Tilt className="stat">
          <span className="stat-label">تم تحصيله</span>
          <span className="stat-value stat-money">{money(delivered)}</span>
          <span className="stat-foot">{counts.delivered ?? 0} طلب تم توصيله</span>
        </Tilt>
      </section>

      <div className="toolbar">
        <nav className="chips" aria-label="تصفية حسب الحالة">
          <Link href={tab("all")} aria-current={status === "all" ? "page" : undefined}>
            الكل <span>{all.length}</span>
          </Link>
          {ORDER_STATUSES.map((s) => (
            <Link key={s} href={tab(s)} aria-current={status === s ? "page" : undefined} className={`chip-${s}`}>
              {STATUS_LABEL[s]} <span>{counts[s] ?? 0}</span>
            </Link>
          ))}
        </nav>
        <form className="search" role="search" action="/admin">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <label htmlFor="q" className="sr-only">
            ابحث في الطلبات
          </label>
          <IcSearch />
          <input id="q" name="q" type="search" defaultValue={q} placeholder="ابحث بالاسم أو الهاتف أو رقم الطلب" />
        </form>
      </div>

      {orders.length === 0 ? (
        <div className="empty">
          <div className="empty-art" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          {all.length === 0 ? (
            <>
              <h2>لا توجد طلبات بعد</h2>
              <p>ستظهر هنا طلبات الدفع عند الاستلام فور وصولها، مع إشعار على هاتفك.</p>
            </>
          ) : (
            <>
              <h2>لا توجد نتائج</h2>
              <p>
                جرّب حالة أخرى أو <Link href="/admin">امسح البحث</Link>.
              </p>
            </>
          )}
        </div>
      ) : (
        <ul className="order-list">
          {orders.map((o, i) => (
            <li key={o.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <Link href={`/admin/orders/${o.id}`} className="order-row">
                <span className="o-main">
                  <span className="o-name" dir="auto">
                    {o.customerName}
                  </span>
                  <span className="o-meta">
                    <span className="o-ref">{o.ref}</span> · {fmtDate(o.createdAt)}
                    {o.area ? <> · <span dir="auto">{o.area}</span></> : null}
                  </span>
                </span>
                <span className="o-item" dir="auto">
                  {o.quantity} × {o.color}
                </span>
                <span className="o-total">{formatMoney(o.totalCents, o.currency)}</span>
                <span className={`badge badge-${o.status}`}>{STATUS_LABEL[o.status]}</span>
              </Link>
              <a href={`tel:${o.phone}`} className="o-call" aria-label={`اتصل بـ ${o.customerName}`}>
                <IcPhone />
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
