import { requireAdmin } from "@/lib/auth";
import { getRack } from "@/lib/db";
import { f } from "@/app/admin/fieldProps";
import { AdminForm, Field } from "@/app/admin/AdminForm";
import { updateRack } from "@/app/admin/actions";
import { ProductSwitch } from "../ProductSwitch";

export default async function RackPage() {
  await requireAdmin();
  const r = await getRack();

  return (
    <>
      <div className="page-head">
        <div><p className="eyebrow">المحتوى</p><h1>المنتج</h1></div>
      </div>
      <ProductSwitch current="rack" />
      <p className="lead">منشر الغسيل الكهربائي. كل ما تكتبه هنا يظهر في صفحة المتجر فور الحفظ.</p>

      <AdminForm action={updateRack} submitLabel="حفظ المنشر" className="admin-form wide">
        <fieldset className="card">
          <legend>السعر والتوفر</legend>
          <div className="a-field toggles">
            <label className="switch">
              <input type="checkbox" name="enabled" defaultChecked={r.enabled} />
              <span aria-hidden />
              إظهار المنشر في المتجر
            </label>
            <label className="switch">
              <input type="checkbox" name="includesDelivery" defaultChecked={r.includesDelivery} />
              <span aria-hidden />
              السعر شامل التوصيل (للداخل والضفة)
            </label>
          </div>
          <div className="grid-3">
            <Field name="price" label="السعر (₪)" hint="الطلبات على المنشر تبقى مغلقة ما دام السعر 0.">
              <input {...f("price")} inputMode="decimal" defaultValue={r.price || ""} placeholder="0" />
            </Field>
            <Field name="maxPerOrder" label="أقصى كمية في الطلب">
              <input {...f("maxPerOrder")} inputMode="numeric" defaultValue={r.maxPerOrder} />
            </Field>
            <Field name="availability" label="التوفر">
              <select {...f("availability")} defaultValue={r.availability}>
                <option value="in_stock">متوفر، استقبل الطلبات</option>
                <option value="sold_out">نفد المخزون، أوقف الطلبات</option>
              </select>
            </Field>
          </div>
          <div className="grid-2">
            <Field name="name" label="اسم المنتج">
              <input {...f("name")} defaultValue={r.name} dir="auto" />
            </Field>
            <Field name="whatsappTitle" label="السطر الأول في رسالة واتساب">
              <input {...f("whatsappTitle")} defaultValue={r.whatsappTitle} dir="auto" />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>النص في صفحة المتجر</legend>
          <Field name="headline" label="العنوان">
            <input {...f("headline")} defaultValue={r.headline} dir="auto" />
          </Field>
          <Field name="intro" label="الفقرة">
            <textarea {...f("intro")} rows={3} defaultValue={r.intro} dir="auto" />
          </Field>
          <Field name="featuresTitle" label="عنوان المميزات">
            <input {...f("featuresTitle")} defaultValue={r.featuresTitle} dir="auto" />
          </Field>
          <Field name="features" label="المميزات" hint="ميزة في كل سطر.">
            <textarea {...f("features")} rows={7} defaultValue={r.features.join("\n")} dir="auto" />
          </Field>
          <Field name="outro" label="السطر الأخير">
            <input {...f("outro")} defaultValue={r.outro} dir="auto" />
          </Field>
        </fieldset>
      </AdminForm>
    </>
  );
}
