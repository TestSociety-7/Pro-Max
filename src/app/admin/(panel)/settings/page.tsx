import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { f } from "@/app/admin/fieldProps";
import { AdminForm, Field } from "@/app/admin/AdminForm";
import { updateSettings } from "@/app/admin/actions";

export default async function SettingsPage() {
  await requireAdmin();
  const s = await getSettings();

  return (
    <>
      <div className="page-head">
        <h1>Store settings</h1>
      </div>
      <p className="lead">
        These details appear across the store: header, delivery section, support box, order form and footer. Saving
        updates the live store immediately — no code changes needed.
      </p>

      <AdminForm action={updateSettings} submitLabel="Save settings" className="admin-form wide">
        <fieldset className="card">
          <legend>Store identity</legend>
          <div className="grid-2">
            <Field name="storeName" label="Store / site name" hint="Shown in the header, browser tab and footer.">
              <input {...f("storeName")} defaultValue={s.storeName} dir="auto" required />
            </Field>
            <Field name="tagline" label="Tagline" hint="Shown in the footer.">
              <input {...f("tagline")} defaultValue={s.tagline} dir="auto" />
            </Field>
          </div>
          <Field name="announcement" label="Announcement bar (optional)" hint="A short line shown above the header. Leave empty to hide.">
            <input {...f("announcement")} defaultValue={s.announcement} dir="auto" />
          </Field>
          <Field name="accentColor" label="Accent color" hint="Buttons and highlights. Default is the logo orange #f26722.">
            <input {...f("accentColor")} type="color" defaultValue={s.accentColor} />
          </Field>
        </fieldset>

        <fieldset className="card">
          <legend>Contact & support</legend>
          <div className="grid-2">
            <Field name="supportPhone" label="Support phone" hint="Shown in the header and support box, with tap-to-call.">
              <input {...f("supportPhone")} type="tel" defaultValue={s.supportPhone} dir="ltr" />
            </Field>
            <Field name="whatsappNumber" label="WhatsApp number" hint="Full international number, e.g. +20 100 000 0000.">
              <input {...f("whatsappNumber")} type="tel" defaultValue={s.whatsappNumber} dir="ltr" />
            </Field>
            <Field name="supportEmail" label="Support email">
              <input {...f("supportEmail")} type="email" defaultValue={s.supportEmail} />
            </Field>
            <Field name="supportHours" label="Support hours">
              <input {...f("supportHours")} defaultValue={s.supportHours} dir="auto" placeholder="مثال: يومياً من 10 صباحاً حتى 10 مساءً" />
            </Field>
          </div>
          <Field name="businessAddress" label="Business address (optional)" hint="Shown in the footer.">
            <input {...f("businessAddress")} defaultValue={s.businessAddress} dir="auto" />
          </Field>
        </fieldset>

        <fieldset className="card">
          <legend>Money & delivery</legend>
          <div className="grid-3">
            <Field name="currencyCode" label="Currency code" hint="3 letters: EGP, SAR, AED, KWD, MAD, IQD…">
              <input {...f("currencyCode")} defaultValue={s.currencyCode} maxLength={3} style={{ textTransform: "uppercase" }} />
            </Field>
            <Field name="deliveryFee" label="Delivery fee" hint="0 = free delivery.">
              <input {...f("deliveryFee")} inputMode="decimal" defaultValue={s.deliveryFee || ""} placeholder="0" />
            </Field>
            <Field name="freeDeliveryFrom" label="Free delivery from (optional)" hint="Order subtotal. Leave empty for never.">
              <input {...f("freeDeliveryFrom")} inputMode="decimal" defaultValue={s.freeDeliveryFrom || ""} />
            </Field>
          </div>
          <div className="grid-2">
            <Field name="serviceArea" label="Service area" hint="Where you deliver.">
              <input {...f("serviceArea")} defaultValue={s.serviceArea} dir="auto" placeholder="مثال: جميع المحافظات" />
            </Field>
            <Field name="deliveryEstimate" label="Delivery estimate" hint='Shown as "خلال …".'>
              <input {...f("deliveryEstimate")} defaultValue={s.deliveryEstimate} dir="auto" placeholder="مثال: 2 إلى 4 أيام عمل" />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>Policies</legend>
          <Field name="returnsPolicy" label="Returns / exchange policy" hint="Leave empty to show “contact us about returns”.">
            <textarea {...f("returnsPolicy")} rows={4} defaultValue={s.returnsPolicy} dir="auto" />
          </Field>
          <Field name="privacyNote" label="Order-form consent text" hint="Customers tick this before ordering.">
            <textarea {...f("privacyNote")} rows={3} defaultValue={s.privacyNote} dir="auto" />
          </Field>
        </fieldset>
      </AdminForm>
    </>
  );
}
