import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getOrder } from "@/lib/db";
import { ORDER_STATUSES, STATUS_LABEL, formatMoney } from "@/lib/content";
import { f } from "@/app/admin/fieldProps";
import { AdminForm, Field } from "../../../AdminForm";
import { setOrderStatus } from "../../../actions";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) notFound();
  const o = await getOrder(n);
  if (!o) notFound();
  const m = (c: number) => formatMoney(c, o.currency, "en");
  const wa = o.phone.replace(/[^\d]/g, "");

  return (
    <>
      <p>
        <Link href="/admin">← All orders</Link>
      </p>
      <div className="page-head">
        <h1>
          Order <span className="ref">{o.ref}</span>
        </h1>
        <span className={`badge badge-${o.status}`}>{STATUS_LABEL[o.status]}</span>
      </div>

      <div className="detail-grid">
        <section className="card">
          <h2>Customer</h2>
          <dl className="dl">
            <dt>Name</dt>
            <dd dir="auto">{o.customerName}</dd>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${o.phone}`}>{o.phone}</a>
              {wa && (
                <>
                  {" · "}
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                </>
              )}
            </dd>
            <dt>Address</dt>
            <dd dir="auto">{o.address}</dd>
            <dt>Area / city</dt>
            <dd dir="auto">{o.area || "—"}</dd>
            <dt>Delivery note</dt>
            <dd dir="auto">{o.note || "—"}</dd>
          </dl>
        </section>

        <section className="card">
          <h2>Order</h2>
          <dl className="dl">
            <dt>Placed</dt>
            <dd>{new Date(o.createdAt).toLocaleString("en-GB")}</dd>
            <dt>Product</dt>
            <dd dir="auto">{o.productName}</dd>
            <dt>Color</dt>
            <dd dir="auto">{o.color}</dd>
            <dt>Quantity</dt>
            <dd>{o.quantity}</dd>
            <dt>Unit price</dt>
            <dd>{m(o.unitPriceCents)}</dd>
            <dt>Delivery fee</dt>
            <dd>{m(o.deliveryFeeCents)}</dd>
            <dt>Collect on delivery</dt>
            <dd>
              <strong>{m(o.totalCents)}</strong>
            </dd>
            <dt>Payment</dt>
            <dd>Cash on delivery</dd>
          </dl>
        </section>

        <section className="card">
          <h2>Update status</h2>
          <AdminForm action={setOrderStatus} submitLabel="Save status">
            <input type="hidden" name="id" value={o.id} />
            <Field name="status" label="Status">
              <select {...f("status")} defaultValue={o.status}>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field name="adminNote" label="Internal note" hint="Only visible to admins.">
              <textarea {...f("adminNote")} rows={3} defaultValue={o.adminNote} maxLength={1000} />
            </Field>
          </AdminForm>
          <p className="a-hint">Last status change: {new Date(o.statusUpdatedAt).toLocaleString("en-GB")}</p>
        </section>
      </div>
    </>
  );
}
