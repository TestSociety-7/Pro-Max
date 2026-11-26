import { requireAdmin } from "@/lib/auth";
import { getProduct } from "@/lib/db";
import { f } from "@/app/admin/fieldProps";
import { AdminForm, Field } from "@/app/admin/AdminForm";
import { updateProduct } from "@/app/admin/actions";
import { ProductSwitch } from "./ProductSwitch";

export default async function ProductPage() {
  await requireAdmin();
  const p = await getProduct();
  const faqText = p.faqs.map((f) => `${f.q}\n${f.a}`).join("\n\n");

  return (
    <>
      <div className="page-head">
        <div><p className="eyebrow">المحتوى</p><h1>المنتج</h1></div>
      </div>
      <ProductSwitch current="salad" />
      <p className="lead">
        كل ما تكتبه هنا يظهر في صفحة المتجر فور الحفظ.
      </p>

      <AdminForm action={updateProduct} submitLabel="حفظ المنتج" className="admin-form wide">
        <fieldset className="card">
          <legend>السعر والتوفر</legend>
          <div className="grid-3">
            <Field name="price" label="السعر (₪)" hint="الطلبات تبقى مغلقة ما دام السعر 0.">
              <input {...f("price")} inputMode="decimal" defaultValue={p.price || ""} placeholder="0" />
            </Field>
            <Field name="compareAtPrice" label="السعر القديم (اختياري)" hint="يظهر مشطوباً. اتركه فارغاً لإخفائه.">
              <input {...f("compareAtPrice")} inputMode="decimal" defaultValue={p.compareAtPrice || ""} />
            </Field>
            <Field name="maxPerOrder" label="أقصى كمية في الطلب">
              <input {...f("maxPerOrder")} inputMode="numeric" defaultValue={p.maxPerOrder} />
            </Field>
          </div>
          <Field name="availability" label="التوفر">
            <select {...f("availability")} defaultValue={p.availability}>
              <option value="in_stock">متوفر، استقبل الطلبات</option>
              <option value="sold_out">نفد المخزون، أوقف الطلبات</option>
            </select>
          </Field>
          <div className="a-field">
            <span className="a-label">الألوان</span>
            <div className="color-rows">
              {p.colors.map((c) => (
                <div key={c.key} className="color-row">
                  <label htmlFor={`color_${c.key}_label`}>{c.key === "black" ? "الأسود" : "البيج"}، الاسم الظاهر</label>
                  <input id={`color_${c.key}_label`} name={`color_${c.key}_label`} defaultValue={c.label} dir="auto" />
                  <label className="check">
                    <input type="checkbox" name={`color_${c.key}_available`} defaultChecked={c.available} /> متوفر
                  </label>
                </div>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>الواجهة الرئيسية</legend>
          <div className="grid-2">
            <Field name="name" label="اسم المنتج">
              <input {...f("name")} defaultValue={p.name} dir="auto" />
            </Field>
            <Field name="modelNumber" label="رقم الموديل">
              <input {...f("modelNumber")} defaultValue={p.modelNumber} />
            </Field>
          </div>
          <Field name="headline" label="العنوان الرئيسي" hint='اترك «7 في 1» في النص ليظهر بالخط البرتقالي الكبير.'>
            <input {...f("headline")} defaultValue={p.headline} dir="auto" />
          </Field>
          <Field name="subheadline" label="العنوان الفرعي">
            <input {...f("subheadline")} defaultValue={p.subheadline} dir="auto" />
          </Field>
          <Field name="keyBenefit" label="الميزة الأساسية">
            <input {...f("keyBenefit")} defaultValue={p.keyBenefit} dir="auto" />
          </Field>
        </fieldset>

        <fieldset className="card">
          <legend>قصة المنتج</legend>
          <Field name="story" label="فقرة تعريفية قصيرة">
            <textarea {...f("story")} rows={3} defaultValue={p.story} dir="auto" />
          </Field>
          <div className="grid-2">
            <Field name="benefits" label="المزايا" hint="ميزة في كل سطر. 6 مزايا تبدو الأفضل.">
              <textarea {...f("benefits")} rows={7} defaultValue={p.benefits.join("\n")} dir="auto" />
            </Field>
            <Field name="functions" label="الوظائف" hint="وظيفة في كل سطر.">
              <textarea {...f("functions")} rows={7} defaultValue={p.functions.join("\n")} dir="auto" />
            </Field>
            <Field name="uses" label="ماذا يقطّع (الشريط تحت الواجهة)" hint="عنصر في كل سطر.">
              <textarea {...f("uses")} rows={6} defaultValue={p.uses.join("\n")} dir="auto" />
            </Field>
            <Field name="included" label="محتويات العلبة" hint="عنصر في كل سطر. لا يظهر القسم إذا كان فارغاً.">
              <textarea {...f("included")} rows={6} defaultValue={p.included.join("\n")} dir="auto" />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>الأسئلة الشائعة</legend>
          <Field
            name="faqs"
            label="الأسئلة والأجوبة"
            hint="السطر الأول هو السؤال والأسطر التالية الجواب. اترك سطراً فارغاً بين كل سؤال وآخر."
          >
            <textarea {...f("faqs")} rows={12} defaultValue={faqText} dir="auto" />
          </Field>
        </fieldset>
      </AdminForm>
    </>
  );
}
