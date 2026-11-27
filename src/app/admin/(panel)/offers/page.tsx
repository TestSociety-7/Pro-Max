import { requireAdmin } from "@/lib/auth";
import { getBundle, getOffers, getProduct, getSettings } from "@/lib/db";
import { formatMoney, toCents } from "@/lib/content";
import { OffersEditor } from "@/app/admin/OffersEditor";
import { AdminForm, Field } from "@/app/admin/AdminForm";
import { f } from "@/app/admin/fieldProps";
import { updateBundle } from "@/app/admin/actions";

export default async function OffersPage() {
  await requireAdmin();
  const [offers, product, settings, bundle] = await Promise.all([getOffers(), getProduct(), getSettings(), getBundle()]);
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

      <AdminForm action={updateBundle} submitLabel="حفظ عرض المنشر + ماكنة السلطة" className="admin-form wide">
        <fieldset className="card">
          <legend>عرض المنشر + ماكنة السلطة معاً</legend>
          <div className="a-field toggles">
            <label className="switch">
              <input type="checkbox" name="active" defaultChecked={bundle.active} />
              <span aria-hidden />
              تفعيل العرض في المتجر
            </label>
            <label className="switch">
              <input type="checkbox" name="includesDelivery" defaultChecked={bundle.includesDelivery} />
              <span aria-hidden />
              السعر شامل التوصيل
            </label>
          </div>
          <div className="grid-2">
            <Field name="title" label="اسم العرض">
              <input {...f("title")} defaultValue={bundle.title} dir="auto" />
            </Field>
            <Field name="price" label="السعر للقطعتين معاً (₪)">
              <input {...f("price")} inputMode="decimal" defaultValue={bundle.price || ""} placeholder="0" />
            </Field>
            <Field name="badge" label="الشارة" hint="مثال: Black Friday. اتركه فارغاً لإخفائها.">
              <input {...f("badge")} defaultValue={bundle.badge} dir="auto" />
            </Field>
            <Field name="endsAt" label="ينتهي في (اختياري)" hint="اتركه فارغاً ليبقى العرض بدون عدّاد.">
              <input {...f("endsAt")} type="date" defaultValue={bundle.endsAt} />
            </Field>
          </div>
        </fieldset>
      </AdminForm>
    </>
  );
}
