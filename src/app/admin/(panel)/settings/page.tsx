import { requireAdmin } from "@/lib/auth";
import { countAdminSessions, getSettings } from "@/lib/db";
import { f } from "@/app/admin/fieldProps";
import { AdminForm, Field } from "@/app/admin/AdminForm";
import { logoutEverywhere, updateSettings } from "@/app/admin/actions";
import { TestPush } from "@/app/admin/TestPush";

export default async function SettingsPage() {
  await requireAdmin();
  const [s, sessions] = await Promise.all([getSettings(), countAdminSessions().catch(() => 1)]);

  return (
    <>
      <div className="page-head">
        <div><p className="eyebrow">المتجر</p><h1>الإعدادات</h1></div>
      </div>
      <p className="lead">
        تظهر هذه البيانات في كل أنحاء المتجر: أعلى الصفحة وقسم التوصيل والدعم ونموذج الطلب. الحفظ يحدّث المتجر فوراً.
      </p>

      <AdminForm action={updateSettings} submitLabel="حفظ الإعدادات" className="admin-form wide">
        <fieldset className="card">
          <legend>هوية المتجر</legend>
          <div className="grid-2">
            <Field name="storeName" label="اسم المتجر" hint="يظهر في أعلى الصفحة وعنوان المتصفح والتذييل.">
              <input {...f("storeName")} defaultValue={s.storeName} dir="auto" required />
            </Field>
            <Field name="tagline" label="الشعار النصي" hint="يظهر في التذييل.">
              <input {...f("tagline")} defaultValue={s.tagline} dir="auto" />
            </Field>
          </div>
          <Field name="announcement" label="شريط الإعلان (اختياري)" hint="سطر قصير أعلى الصفحة. اتركه فارغاً لإخفائه.">
            <input {...f("announcement")} defaultValue={s.announcement} dir="auto" />
          </Field>
          <Field name="accentColor" label="اللون الرئيسي" hint="لون الأزرار والتمييز. الافتراضي برتقالي الشعار.">
            <input {...f("accentColor")} type="color" defaultValue={s.accentColor} />
          </Field>
        </fieldset>

        <fieldset className="card">
          <legend>التواصل والدعم</legend>
          <div className="grid-2">
            <Field name="supportPhone" label="هاتف الدعم" hint="يظهر أعلى الصفحة وفي قسم الدعم مع زر اتصال.">
              <input {...f("supportPhone")} type="tel" defaultValue={s.supportPhone} dir="ltr" />
            </Field>
            <Field name="whatsappNumber" label="رقم واتساب (تصله الطلبات)" hint="بعد كل طلب يُفتح واتساب العميل برسالة فيها كل تفاصيل الطلب إلى هذا الرقم. اكتبه دولياً، مثال: 972599123456+">
              <input {...f("whatsappNumber")} type="tel" defaultValue={s.whatsappNumber} dir="ltr" />
            </Field>
            <div className="a-field toggles">
              <label className="switch">
                <input type="checkbox" name="showWhatsappButton" defaultChecked={s.showWhatsappButton} />
                <span aria-hidden />
                زر واتساب العائم في المتجر (للتواصل في أي وقت)
              </label>
              <label className="switch">
                <input type="checkbox" name="whatsappCheckout" defaultChecked={s.whatsappCheckout} />
                <span aria-hidden />
                بعد الطلب افتح واتساب برسالة الطلب إليّ
              </label>
            </div>
            <Field name="supportHours" label="ساعات الدعم">
              <input {...f("supportHours")} defaultValue={s.supportHours} dir="auto" placeholder="مثال: يومياً من 10 صباحاً حتى 10 مساءً" />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>العملة والتوصيل</legend>
          <div className="grid-2">
            <Field name="currencyCode" label="العملة" hint="ILS = شيكل (₪).">
              <input {...f("currencyCode")} defaultValue={s.currencyCode} maxLength={3} style={{ textTransform: "uppercase" }} />
            </Field>
            <Field name="deliveryFee" label="التوصيل للداخل (₪)" hint="0 = توصيل مجاني.">
              <input {...f("deliveryFee")} inputMode="decimal" defaultValue={s.deliveryFee || ""} placeholder="0" />
            </Field>
            <Field name="deliveryFeeWestBank" label="التوصيل للضفة (₪)" hint="0 = توصيل مجاني.">
              <input {...f("deliveryFeeWestBank")} inputMode="decimal" defaultValue={s.deliveryFeeWestBank || ""} placeholder="0" />
            </Field>
            <Field name="freeDeliveryFrom" label="توصيل مجاني ابتداءً من (اختياري)" hint="قيمة الطلب. اتركه فارغاً لإلغائه.">
              <input {...f("freeDeliveryFrom")} inputMode="decimal" defaultValue={s.freeDeliveryFrom || ""} />
            </Field>
          </div>
          <div className="grid-2">
            <Field name="serviceArea" label="مناطق التوصيل" hint="أين توصّل الطلبات.">
              <input {...f("serviceArea")} defaultValue={s.serviceArea} dir="auto" placeholder="مثال: جميع المحافظات" />
            </Field>
            <Field name="deliveryEstimate" label="مدة التوصيل" hint='تظهر بصيغة «خلال …».'>
              <input {...f("deliveryEstimate")} defaultValue={s.deliveryEstimate} dir="auto" placeholder="مثال: 2 إلى 4 أيام عمل" />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>السياسات</legend>
          <Field name="returnsPolicy" label="سياسة الإرجاع والاستبدال" hint="إذا تركته فارغاً يظهر «تواصل معنا بخصوص الإرجاع».">
            <textarea {...f("returnsPolicy")} rows={4} defaultValue={s.returnsPolicy} dir="auto" />
          </Field>
        </fieldset>
      </AdminForm>

      <section className="card security-card">
        <h2>إشعارات الطلبات</h2>
        <p>
          على iPhone: افتح لوحة التحكم من أيقونة التطبيق على الشاشة الرئيسية، اضغط زر الجرس 🔔 في الأعلى واختر «السماح».
          بعدها اضغط الزر هنا للتأكد أن الإشعار يصل.
        </p>
        <TestPush />
      </section>

      <section className="card danger-card security-card">
        <h2>الأمان</h2>
        <p>
          لوحة التحكم محمية بكلمة مرور مشفّرة، وجلسة تنتهي تلقائياً بعد 12 ساعة، وقفل بعد المحاولات الخاطئة المتكررة.
        </p>
        <p className="muted">الأجهزة المسجّلة الآن: {sessions}</p>
        <form action={logoutEverywhere}>
          <button type="submit" className="a-btn a-btn-danger">
            تسجيل الخروج من كل الأجهزة
          </button>
        </form>
      </section>
    </>
  );
}
