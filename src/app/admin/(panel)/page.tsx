import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { countOrdersByStatus, databaseStatus, getProduct, getSettings, listOrders } from "@/lib/db";
import { ORDER_STATUSES, STATUS_LABEL, formatMoney, isStatus, isValidCurrency } from "@/lib/content";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
    const [orders, counts, product, settings] = await Promise.all([
      listOrders({ status, q }),
      countOrdersByStatus(),
      getProduct(),
      getSettings(),
    ]);
    data = { orders, counts, product, settings };
  } catch (err) {
    console.error("admin orders", err);
    const dbs = await databaseStatus();
    return (
      <div className="a-msg a-msg-err" role="alert">
        <p>
          <strong>Could not load orders.</strong> {dbs.error ?? "The database did not respond. Reload in a moment."}
        </p>
      </div>
    );
  }
  const { orders, counts, product, settings } = data;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const setup: string[] = [];
  if (!(product.price > 0)) setup.push("Set the product price (Product).");
  if (!isValidCurrency(settings.currencyCode)) setup.push("Set the currency code (Store settings).");
  if (!settings.supportPhone) setup.push("Add a support phone number (Store settings).");
  if (!settings.serviceArea || !settings.deliveryEstimate) setup.push("Add service area and delivery estimate (Store settings).");
  if (!settings.returnsPolicy) setup.push("Add your returns / exchange policy (Store settings).");

  const tab = (s: string) => {
    const params = new URLSearchParams();
    if (s !== "all") params.set("status", s);
    if (q) params.set("q", q);
    const qs = params.toString();
    return `/admin${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      {setup.length > 0 && (
        <section className="setup" aria-labelledby="setup-title">
          <h2 id="setup-title">Finish setting up your store</h2>
          {!(product.price > 0 && isValidCurrency(settings.currencyCode)) && (
            <p>
              <strong>Ordering is closed</strong> until the price and currency are set.
            </p>
          )}
          <ul>
            {setup.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="page-head">
        <h1>Orders</h1>
        <form className="search" role="search" action="/admin">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <label htmlFor="q" className="sr-only">
            Search orders
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Search name, phone, ref, area" />
          <button className="a-btn" type="submit">
            Search
          </button>
        </form>
      </div>

      <nav className="tabs" aria-label="Filter by status">
        <Link href={tab("all")} aria-current={status === "all" ? "page" : undefined}>
          All <span>{total}</span>
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link key={s} href={tab(s)} aria-current={status === s ? "page" : undefined}>
            {STATUS_LABEL[s]} <span>{counts[s] ?? 0}</span>
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <div className="empty">
          {total === 0 ? (
            <>
              <h2>No orders yet</h2>
              <p>New cash-on-delivery orders from the store will appear here.</p>
            </>
          ) : (
            <>
              <h2>No matching orders</h2>
              <p>
                Try another filter or <Link href="/admin">clear the search</Link>.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="orders">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Date</th>
                <th scope="col">Customer</th>
                <th scope="col">Phone</th>
                <th scope="col">Area</th>
                <th scope="col">Item</th>
                <th scope="col" className="num">
                  Total
                </th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td data-label="Order">
                    <Link href={`/admin/orders/${o.id}`} className="ref">
                      {o.ref}
                    </Link>
                  </td>
                  <td data-label="Date">{fmtDate(o.createdAt)}</td>
                  <td data-label="Customer" dir="auto">
                    {o.customerName}
                  </td>
                  <td data-label="Phone">
                    <a href={`tel:${o.phone}`}>{o.phone}</a>
                  </td>
                  <td data-label="Area" dir="auto">
                    {o.area || "—"}
                  </td>
                  <td data-label="Item" dir="auto">
                    {o.quantity} × {o.color}
                  </td>
                  <td data-label="Total" className="num">
                    {formatMoney(o.totalCents, o.currency, "en")}
                  </td>
                  <td data-label="Status">
                    <span className={`badge badge-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
