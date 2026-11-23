import { requireAdmin } from "@/lib/auth";
import { getProduct } from "@/lib/db";
import { f } from "@/app/admin/fieldProps";
import { AdminForm, Field } from "@/app/admin/AdminForm";
import { updateProduct } from "@/app/admin/actions";

export default async function ProductPage() {
  await requireAdmin();
  const p = await getProduct();
  const faqText = p.faqs.map((f) => `${f.q}\n${f.a}`).join("\n\n");

  return (
    <>
      <div className="page-head">
        <h1>Product</h1>
      </div>
      <p className="lead">
        Customer-facing text is shown in Arabic on the store. Changes go live as soon as you save.
      </p>

      <AdminForm action={updateProduct} submitLabel="Save product" className="admin-form wide">
        <fieldset className="card">
          <legend>Price & availability</legend>
          <div className="grid-3">
            <Field name="price" label="Price" hint="In your store currency. Ordering stays closed while this is 0.">
              <input {...f("price")} inputMode="decimal" defaultValue={p.price || ""} placeholder="0" />
            </Field>
            <Field name="compareAtPrice" label="Old price (optional)" hint="Shown crossed out. Leave empty to hide.">
              <input {...f("compareAtPrice")} inputMode="decimal" defaultValue={p.compareAtPrice || ""} />
            </Field>
            <Field name="maxPerOrder" label="Max quantity per order">
              <input {...f("maxPerOrder")} inputMode="numeric" defaultValue={p.maxPerOrder} />
            </Field>
          </div>
          <Field name="availability" label="Availability">
            <select {...f("availability")} defaultValue={p.availability}>
              <option value="in_stock">In stock — accept orders</option>
              <option value="sold_out">Sold out — stop orders</option>
            </select>
          </Field>
          <div className="a-field">
            <span className="a-label">Colors</span>
            <div className="color-rows">
              {p.colors.map((c) => (
                <div key={c.key} className="color-row">
                  <label htmlFor={`color_${c.key}_label`}>{c.key === "black" ? "Black" : "Beige"} — label shown</label>
                  <input id={`color_${c.key}_label`} name={`color_${c.key}_label`} defaultValue={c.label} dir="auto" />
                  <label className="check">
                    <input type="checkbox" name={`color_${c.key}_available`} defaultChecked={c.available} /> Available
                  </label>
                </div>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>Opening scene</legend>
          <div className="grid-2">
            <Field name="name" label="Product name">
              <input {...f("name")} defaultValue={p.name} dir="auto" />
            </Field>
            <Field name="modelNumber" label="Model / item number">
              <input {...f("modelNumber")} defaultValue={p.modelNumber} />
            </Field>
          </div>
          <Field name="headline" label="Headline" hint='Keep "7 في 1" in the text to get the large orange 7-in-1 styling.'>
            <input {...f("headline")} defaultValue={p.headline} dir="auto" />
          </Field>
          <Field name="subheadline" label="Sub-headline">
            <input {...f("subheadline")} defaultValue={p.subheadline} dir="auto" />
          </Field>
          <Field name="keyBenefit" label="Key benefit line">
            <input {...f("keyBenefit")} defaultValue={p.keyBenefit} dir="auto" />
          </Field>
        </fieldset>

        <fieldset className="card">
          <legend>Product story</legend>
          <Field name="story" label="Short story paragraph">
            <textarea {...f("story")} rows={3} defaultValue={p.story} dir="auto" />
          </Field>
          <div className="grid-2">
            <Field name="benefits" label="Benefits" hint="One per line. Up to 6 look best.">
              <textarea {...f("benefits")} rows={7} defaultValue={p.benefits.join("\n")} dir="auto" />
            </Field>
            <Field name="functions" label="Functions" hint="One per line.">
              <textarea {...f("functions")} rows={7} defaultValue={p.functions.join("\n")} dir="auto" />
            </Field>
            <Field name="uses" label="What it cuts (strip under the opening)" hint="One per line.">
              <textarea {...f("uses")} rows={6} defaultValue={p.uses.join("\n")} dir="auto" />
            </Field>
            <Field name="included" label="What's in the box" hint="One per line. Hidden while empty — please confirm the exact contents.">
              <textarea {...f("included")} rows={6} defaultValue={p.included.join("\n")} dir="auto" />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>FAQs</legend>
          <Field
            name="faqs"
            label="Questions and answers"
            hint="First line is the question, the next line(s) the answer. Leave one empty line between FAQs."
          >
            <textarea {...f("faqs")} rows={12} defaultValue={faqText} dir="auto" />
          </Field>
        </fieldset>
      </AdminForm>
    </>
  );
}
