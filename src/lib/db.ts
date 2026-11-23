import "server-only";
import { randomBytes } from "node:crypto";
import {
  DEFAULT_PRODUCT,
  DEFAULT_SETTINGS,
  type OrderStatus,
  type ProductContent,
  type StoreSettings,
  withDefaults,
} from "./content";

// Storage adapter. Works with either:
//  - libSQL / SQLite: a local file in development, Turso in production
//  - Postgres: e.g. Neon or Supabase connected from Vercel → Storage
// The connection is found from the environment variables those integrations set,
// so whichever database is connected in Vercel is picked up without code changes.

type Row = Record<string, unknown>;
type Arg = string | number | null;
interface Store {
  kind: "libsql" | "postgres";
  query(sql: string, args?: Arg[]): Promise<Row[]>;
}

export class DbNotConfiguredError extends Error {}

type DbConfig =
  | { kind: "libsql"; url: string; authToken?: string; source: string }
  | { kind: "postgres"; url: string; source: string }
  | { kind: "none"; reason: string };

const isPg = (v?: string) => !!v && /^postgres(ql)?:\/\//i.test(v);
const isLibsql = (v?: string) => !!v && /^(libsql|wss?|https?):\/\//i.test(v) && !isPg(v);

/** Figure out which database to use from environment variables. */
export function resolveDbConfig(): DbConfig {
  const env = process.env;
  const keys = Object.keys(env);

  // 1. Explicit
  if (isPg(env.DATABASE_URL)) return { kind: "postgres", url: env.DATABASE_URL!, source: "DATABASE_URL" };
  if (env.DATABASE_URL && (isLibsql(env.DATABASE_URL) || env.DATABASE_URL.startsWith("file:")))
    return { kind: "libsql", url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN || env.TURSO_AUTH_TOKEN || undefined, source: "DATABASE_URL" };

  // 2. Turso (Vercel Marketplace may add a custom prefix, e.g. STORAGE_TURSO_DATABASE_URL)
  const tursoKey = keys.find((k) => k.endsWith("TURSO_DATABASE_URL") && isLibsql(env[k]));
  if (tursoKey) {
    const prefix = tursoKey.slice(0, -"TURSO_DATABASE_URL".length);
    const token = env[`${prefix}TURSO_AUTH_TOKEN`] || env.TURSO_AUTH_TOKEN || keys.map((k) => (k.endsWith("TURSO_AUTH_TOKEN") ? env[k] : undefined)).find(Boolean);
    return { kind: "libsql", url: env[tursoKey]!, authToken: token || undefined, source: tursoKey };
  }

  // 3. Postgres (Neon / Supabase / Vercel Postgres, possibly prefixed)
  const pgKey =
    ["POSTGRES_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_PRISMA_URL"].find((k) => isPg(env[k])) ??
    keys.find((k) => /(DATABASE_URL|POSTGRES_URL)$/.test(k) && isPg(env[k]));
  if (pgKey) return { kind: "postgres", url: env[pgKey]!, source: pgKey };

  // 4. Any libsql:// value
  const anyLibsql = keys.find((k) => env[k]?.startsWith("libsql://"));
  if (anyLibsql) return { kind: "libsql", url: env[anyLibsql]!, authToken: env.TURSO_AUTH_TOKEN, source: anyLibsql };

  // 5. Local development fallback. Vercel's filesystem is read-only, so not there.
  if (env.VERCEL) {
    return {
      kind: "none",
      reason:
        "لا توجد قاعدة بيانات متصلة. في Vercel افتح Storage وأنشئ قاعدة Neon أو Turso واربطها بهذا المشروع ثم أعد النشر.",
    };
  }
  return { kind: "libsql", url: "file:./data/promax.db", source: "local file" };
}

let store: Store | null = null;
let ready: Promise<void> | null = null;

async function makeStore(): Promise<Store> {
  const cfg = resolveDbConfig();
  if (cfg.kind === "none") throw new DbNotConfiguredError(cfg.reason);
  if (cfg.kind === "postgres") {
    const { default: postgres } = await import("postgres");
    const sql = postgres(cfg.url, { ssl: /localhost|127\.0\.0\.1/.test(cfg.url) ? false : "require", max: 3, prepare: false });
    return {
      kind: "postgres",
      async query(text, args = []) {
        let i = 0;
        const pgText = text.replace(/\?/g, () => `$${++i}`);
        const rows = await sql.unsafe(pgText, args as never[]);
        return rows as unknown as Row[];
      },
    };
  }
  const { createClient } = await import("@libsql/client");
  const c = createClient({ url: cfg.url, authToken: cfg.authToken });
  return {
    kind: "libsql",
    async query(text, args = []) {
      const rs = await c.execute({ sql: text, args });
      return rs.rows as unknown as Row[];
    },
  };
}

async function migrate(s: Store) {
  const pk = s.kind === "postgres" ? "SERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT";
  const big = s.kind === "postgres" ? "BIGINT" : "INTEGER";
  const stmts = [
    `CREATE TABLE IF NOT EXISTS content (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id ${pk},
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
      unit_price_cents ${big} NOT NULL,
      delivery_fee_cents ${big} NOT NULL,
      total_cents ${big} NOT NULL,
      currency TEXT NOT NULL,
      product_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      status_updated_at TEXT NOT NULL,
      admin_note TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)`,
    `CREATE TABLE IF NOT EXISTS login_attempts (
      id ${pk},
      attempt_key TEXT NOT NULL,
      attempted_at ${big} NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(attempt_key, attempted_at)`,
    `CREATE TABLE IF NOT EXISTS push_subs (
      endpoint TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS presence (
      id TEXT PRIMARY KEY,
      last_seen ${big} NOT NULL,
      path TEXT NOT NULL DEFAULT ''
    )`,
  ];
  for (const q of stmts) await s.query(q);
}

async function db(): Promise<Store> {
  if (!store) store = await makeStore();
  const s = store;
  if (!ready) {
    ready = migrate(s).catch((err) => {
      ready = null;
      store = null;
      throw err;
    });
  }
  await ready;
  return s;
}

/** For the admin: is the database reachable, and which one is it? */
export async function databaseStatus(): Promise<{ ok: boolean; kind?: string; source?: string; error?: string }> {
  const cfg = resolveDbConfig();
  if (cfg.kind === "none") return { ok: false, error: cfg.reason };
  try {
    await db();
    return { ok: true, kind: cfg.kind === "postgres" ? "Postgres" : cfg.url.startsWith("file:") ? "Local SQLite file" : "Turso / libSQL", source: cfg.source };
  } catch (err) {
    return { ok: false, kind: cfg.kind, source: cfg.source, error: String((err as Error)?.message ?? err).slice(0, 300) };
  }
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === "23505" || /UNIQUE|duplicate key/i.test(String(e?.message ?? ""));
}

/* ---------------------------- content ---------------------------------- */

async function readContent(id: string): Promise<unknown> {
  const rows = await (await db()).query("SELECT data FROM content WHERE id = ?", [id]);
  if (!rows.length) return null;
  try {
    return JSON.parse(String(rows[0].data));
  } catch {
    return null;
  }
}

async function writeContent(id: string, data: unknown) {
  await (await db()).query(
    `INSERT INTO content (id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [id, JSON.stringify(data), new Date().toISOString()],
  );
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
  const existing = await c.query("SELECT * FROM orders WHERE idempotency_key = ?", [o.idempotencyKey]);
  if (existing.length) return { order: rowToOrder(existing[0]), duplicate: true };

  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = makeRef();
    try {
      const rows = await c.query(
        `INSERT INTO orders (ref, idempotency_key, created_at, customer_name, phone, address, area, note, color,
                quantity, unit_price_cents, delivery_fee_cents, total_cents, currency, product_name, status, status_updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?) RETURNING *`,
        [
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
      );
      return { order: rowToOrder(rows[0]), duplicate: false };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const again = await c.query("SELECT * FROM orders WHERE idempotency_key = ?", [o.idempotencyKey]);
      if (again.length) return { order: rowToOrder(again[0]), duplicate: true };
      // ref collision: try another
    }
  }
  throw new Error("Could not allocate an order reference");
}

export async function listOrders(opts: { status?: OrderStatus | "all"; q?: string; limit?: number }) {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.status && opts.status !== "all") {
    where.push("status = ?");
    args.push(opts.status);
  } else if (opts.status === "all") {
    // "All" is the working list: cancelled orders only show under their own filter.
    where.push("status <> 'cancelled'");
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
  const rows = await (await db()).query(sql, args);
  return rows.map(rowToOrder);
}

export async function countOrdersByStatus(): Promise<Record<string, number>> {
  const rows = await (await db()).query("SELECT status, COUNT(*) AS n FROM orders GROUP BY status");
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.status)] = Number(r.n);
  return out;
}

export async function getOrder(id: number): Promise<Order | null> {
  const rows = await (await db()).query("SELECT * FROM orders WHERE id = ?", [id]);
  return rows.length ? rowToOrder(rows[0]) : null;
}

export async function updateOrderStatus(id: number, status: OrderStatus, adminNote: string) {
  await (await db()).query("UPDATE orders SET status = ?, admin_note = ?, status_updated_at = ? WHERE id = ?", [
    status,
    adminNote,
    new Date().toISOString(),
    id,
  ]);
}

export async function deleteOrders(ids: number[]) {
  const clean = ids.filter((n) => Number.isInteger(n) && n > 0).slice(0, 100);
  if (!clean.length) return;
  await (await db()).query(`DELETE FROM orders WHERE id IN (${clean.map(() => "?").join(",")})`, clean);
}

/* --------------------------- login throttle ---------------------------- */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

export async function tooManyLoginFailures(key: string): Promise<boolean> {
  const c = await db();
  const since = Date.now() - WINDOW_MS;
  await c.query("DELETE FROM login_attempts WHERE attempted_at < ?", [since]);
  const rows = await c.query("SELECT COUNT(*) AS n FROM login_attempts WHERE attempt_key = ? AND attempted_at >= ?", [key, since]);
  return Number(rows[0]?.n ?? 0) >= MAX_FAILURES;
}

export async function recordLoginFailure(key: string) {
  await (await db()).query("INSERT INTO login_attempts (attempt_key, attempted_at) VALUES (?, ?)", [key, Date.now()]);
}

export async function clearLoginFailures(key: string) {
  await (await db()).query("DELETE FROM login_attempts WHERE attempt_key = ?", [key]);
}

/* ------------------------ admin notifications -------------------------- */

/** Orders newer than the given id, oldest first (for the admin's live new-order alerts). */
export async function ordersAfter(id: number, limit = 20): Promise<Order[]> {
  const rows = await (await db()).query("SELECT * FROM orders WHERE id > ? ORDER BY id ASC LIMIT ?", [id, limit]);
  return rows.map(rowToOrder);
}

export async function latestOrderId(): Promise<number> {
  const rows = await (await db()).query("SELECT MAX(id) AS m FROM orders");
  return Number(rows[0]?.m ?? 0) || 0;
}

/** Web Push keys are created once and kept in the database, so no extra environment variables are needed. */
export async function getVapidKeys(create: () => { publicKey: string; privateKey: string }) {
  const existing = (await readContent("vapid")) as { publicKey?: string; privateKey?: string } | null;
  if (existing?.publicKey && existing?.privateKey) return existing as { publicKey: string; privateKey: string };
  const keys = create();
  await (await db()).query(
    `INSERT INTO content (id, data, updated_at) VALUES ('vapid', ?, ?) ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(keys), new Date().toISOString()],
  );
  return (await readContent("vapid")) as { publicKey: string; privateKey: string };
}

export async function savePushSub(endpoint: string, data: string) {
  await (await db()).query(
    `INSERT INTO push_subs (endpoint, data, created_at) VALUES (?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET data = excluded.data`,
    [endpoint, data, new Date().toISOString()],
  );
}

export async function deletePushSub(endpoint: string) {
  await (await db()).query("DELETE FROM push_subs WHERE endpoint = ?", [endpoint]);
}

export async function listPushSubs(): Promise<{ endpoint: string; data: string }[]> {
  const rows = await (await db()).query("SELECT endpoint, data FROM push_subs");
  return rows.map((r) => ({ endpoint: String(r.endpoint), data: String(r.data) }));
}

// ---- live visitors -------------------------------------------------------

export const PRESENCE_WINDOW_MS = 60_000;

/** A store visitor's heartbeat. Old rows are swept now and then so the table stays tiny. */
export async function touchPresence(id: string, path: string) {
  const c = await db();
  const now = Date.now();
  await c.query(
    `INSERT INTO presence (id, last_seen, path) VALUES (?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET last_seen = excluded.last_seen, path = excluded.path`,
    [id, now, path],
  );
  if (Math.random() < 0.1) await c.query("DELETE FROM presence WHERE last_seen < ?", [now - 10 * 60_000]);
}

export async function leavePresence(id: string) {
  await (await db()).query("DELETE FROM presence WHERE id = ?", [id]);
}

export async function countLiveVisitors(): Promise<{ total: number; ordering: number }> {
  const rows = await (await db()).query(
    "SELECT path, COUNT(*) AS n FROM presence WHERE last_seen >= ? GROUP BY path",
    [Date.now() - PRESENCE_WINDOW_MS],
  );
  let total = 0;
  let ordering = 0;
  for (const r of rows) {
    const n = Number(r.n) || 0;
    total += n;
    if (r.path === "order") ordering += n;
  }
  return { total, ordering };
}
