import "server-only";
import { createClient, type Client } from "@libsql/client";
import { randomBytes } from "node:crypto";
import {
  DEFAULT_PRODUCT,
  DEFAULT_SETTINGS,
  type OrderStatus,
  type ProductContent,
  type StoreSettings,
  withDefaults,
} from "./content";

// One libSQL client per server process. Locally this is a SQLite file;
// in production point DATABASE_URL at a hosted libSQL database (e.g. Turso).
let client: Client | null = null;
let ready: Promise<void> | null = null;

function getClient(): Client {
  if (!client) {
    // TURSO_* names are what the Vercel Marketplace Turso integration sets.
    const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./data/promax.db";
    const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined;
    client = createClient({ url, authToken });
  }
  return client;
}

async function migrate(db: Client) {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS content (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ref TEXT NOT NULL UNIQUE,
        idempotency_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        area TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '',
        quantity INTEGER NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        delivery_fee_cents INTEGER NOT NULL,
        total_cents INTEGER NOT NULL,
        currency TEXT NOT NULL,
        product_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        status_updated_at TEXT NOT NULL,
        admin_note TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)`,
      `CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(key, at)`,
    ],
    "write",
  );
}

export async function db(): Promise<Client> {
  const c = getClient();
  if (!ready) {
    ready = migrate(c).catch((err) => {
      ready = null;
      throw err;
    });
  }
  await ready;
  return c;
}

/* ---------------------------- content ---------------------------------- */

async function readContent(id: string): Promise<unknown> {
  const c = await db();
  const rs = await c.execute({ sql: "SELECT data FROM content WHERE id = ?", args: [id] });
  if (!rs.rows.length) return null;
  try {
    return JSON.parse(String(rs.rows[0].data));
  } catch {
    return null;
  }
}

async function writeContent(id: string, data: unknown) {
  const c = await db();
  await c.execute({
    sql: `INSERT INTO content (id, data, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    args: [id, JSON.stringify(data), new Date().toISOString()],
  });
}

export async function getSettings(): Promise<StoreSettings> {
  return withDefaults(DEFAULT_SETTINGS, await readContent("settings"));
}
export async function saveSettings(s: StoreSettings) {
  await writeContent("settings", s);
}
export async function getProduct(): Promise<ProductContent> {
  return withDefaults(DEFAULT_PRODUCT, await readContent("product"));
}
export async function saveProduct(p: ProductContent) {
  await writeContent("product", p);
}

/* ----------------------------- orders ---------------------------------- */

export type Order = {
  id: number;
  ref: string;
  createdAt: string;
  customerName: string;
  phone: string;
  address: string;
  area: string;
  note: string;
  color: string;
  quantity: number;
  unitPriceCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  currency: string;
  productName: string;
  status: OrderStatus;
  statusUpdatedAt: string;
  adminNote: string;
};

function rowToOrder(r: Record<string, unknown>): Order {
  return {
    id: Number(r.id),
    ref: String(r.ref),
    createdAt: String(r.created_at),
    customerName: String(r.customer_name),
    phone: String(r.phone),
    address: String(r.address),
    area: String(r.area ?? ""),
    note: String(r.note ?? ""),
    color: String(r.color ?? ""),
    quantity: Number(r.quantity),
    unitPriceCents: Number(r.unit_price_cents),
    deliveryFeeCents: Number(r.delivery_fee_cents),
    totalCents: Number(r.total_cents),
    currency: String(r.currency),
    productName: String(r.product_name),
    status: String(r.status) as OrderStatus,
    statusUpdatedAt: String(r.status_updated_at),
    adminNote: String(r.admin_note ?? ""),
  };
}

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function makeRef(): string {
  const bytes = randomBytes(6);
  let s = "";
  for (const b of bytes) s += REF_ALPHABET[b % REF_ALPHABET.length];
  return `PM-${s}`;
}

export type NewOrder = Omit<Order, "id" | "ref" | "createdAt" | "status" | "statusUpdatedAt" | "adminNote"> & {
  idempotencyKey: string;
};

/**
 * Insert an order. If the same idempotency key was already used (double tap,
 * network retry) the existing order is returned instead of creating a duplicate.
 */
export async function createOrder(o: NewOrder): Promise<{ order: Order; duplicate: boolean }> {
  const c = await db();
  const existing = await c.execute({
    sql: "SELECT * FROM orders WHERE idempotency_key = ?",
    args: [o.idempotencyKey],
  });
  if (existing.rows.length) return { order: rowToOrder(existing.rows[0]), duplicate: true };

  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = makeRef();
    try {
      const rs = await c.execute({
        sql: `INSERT INTO orders (ref, idempotency_key, created_at, customer_name, phone, address, area, note, color,
                quantity, unit_price_cents, delivery_fee_cents, total_cents, currency, product_name, status, status_updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?) RETURNING *`,
        args: [
          ref,
          o.idempotencyKey,
          now,
          o.customerName,
          o.phone,
          o.address,
          o.area,
          o.note,
          o.color,
          o.quantity,
          o.unitPriceCents,
          o.deliveryFeeCents,
          o.totalCents,
          o.currency,
          o.productName,
          now,
        ],
      });
      return { order: rowToOrder(rs.rows[0]), duplicate: false };
    } catch (err) {
      const msg = String((err as Error)?.message ?? err);
      if (msg.includes("idempotency_key")) {
        const again = await c.execute({
          sql: "SELECT * FROM orders WHERE idempotency_key = ?",
          args: [o.idempotencyKey],
        });
        if (again.rows.length) return { order: rowToOrder(again.rows[0]), duplicate: true };
      }
      if (!msg.includes("UNIQUE")) throw err;
      // ref collision: try another
    }
  }
  throw new Error("Could not allocate an order reference");
}

export async function listOrders(opts: { status?: OrderStatus | "all"; q?: string; limit?: number }) {
  const c = await db();
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.status && opts.status !== "all") {
    where.push("status = ?");
    args.push(opts.status);
  }
  const q = opts.q?.trim();
  if (q) {
    where.push("(ref LIKE ? OR customer_name LIKE ? OR phone LIKE ? OR area LIKE ? OR address LIKE ?)");
    const like = `%${q.replace(/[%_]/g, "")}%`;
    args.push(like, like, like, like, like);
  }
  const sql = `SELECT * FROM orders ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY created_at DESC LIMIT ?`;
  args.push(Math.min(Math.max(opts.limit ?? 200, 1), 500));
  const rs = await c.execute({ sql, args });
  return rs.rows.map((r) => rowToOrder(r as Record<string, unknown>));
}

export async function countOrdersByStatus(): Promise<Record<string, number>> {
  const c = await db();
  const rs = await c.execute("SELECT status, COUNT(*) AS n FROM orders GROUP BY status");
  const out: Record<string, number> = {};
  for (const r of rs.rows) out[String(r.status)] = Number(r.n);
  return out;
}

export async function getOrder(id: number): Promise<Order | null> {
  const c = await db();
  const rs = await c.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [id] });
  return rs.rows.length ? rowToOrder(rs.rows[0] as Record<string, unknown>) : null;
}

export async function updateOrderStatus(id: number, status: OrderStatus, adminNote: string) {
  const c = await db();
  await c.execute({
    sql: "UPDATE orders SET status = ?, admin_note = ?, status_updated_at = ? WHERE id = ?",
    args: [status, adminNote, new Date().toISOString(), id],
  });
}

/* --------------------------- login throttle ---------------------------- */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

export async function tooManyLoginFailures(key: string): Promise<boolean> {
  const c = await db();
  const since = Date.now() - WINDOW_MS;
  await c.execute({ sql: "DELETE FROM login_attempts WHERE at < ?", args: [since] });
  const rs = await c.execute({
    sql: "SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND at >= ?",
    args: [key, since],
  });
  return Number(rs.rows[0]?.n ?? 0) >= MAX_FAILURES;
}

export async function recordLoginFailure(key: string) {
  const c = await db();
  await c.execute({ sql: "INSERT INTO login_attempts (key, at) VALUES (?, ?)", args: [key, Date.now()] });
}

export async function clearLoginFailures(key: string) {
  const c = await db();
  await c.execute({ sql: "DELETE FROM login_attempts WHERE key = ?", args: [key] });
}
