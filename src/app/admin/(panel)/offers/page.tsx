import { requireAdmin } from "@/lib/auth";
import { getOffers, getProduct, getSettings } from "@/lib/db";
import { formatMoney, toCents } from "@/lib/content";
import { OffersEditor } from "@/app/admin/OffersEditor";

export default async function OffersPage() {
  await requireAdmin();
  const [offers, product, settings] = await Promise.all([getOffers(), getProduct(), getSettings()]);
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">المبيعات</p>
          <h1>العروض والباقات</h1>
        </div>
      </div>
      <p className="lead">
        العرض المفعّل يظهر في الصفحة الرئيسية بتصميم ثلاثي الأبعاد، ويستطيع الزبون اختياره مباشرة في نموذج الطلب.
        {product.price > 0 && <> سعر القطعة الواحدة حالياً {formatMoney(toCents(product.price), settings.currencyCode)}.</>}
      </p>
      <OffersEditor initial={offers} unitPrice={product.price} />
    </>
  );
}
