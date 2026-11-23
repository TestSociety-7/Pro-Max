# Pro Max — single-product cash-on-delivery store

A mobile-first, Arabic (right-to-left) one-page store for the **Pro Max Salad Maker 7 in 1** (item PR-067), with cash-on-delivery ordering and a private admin panel (English).

- **Storefront** (`/`): opening scene with both colors, price and buy button; what it cuts; product story and six features from the box; black/beige color showcase and functions; the Arabic poster; delivery + COD steps; returns/support; FAQs; order form with live total and a clear confirmation with order reference.
- **Admin** (`/admin`): sign-in, order list with search and status filter, order detail with status updates (New → Confirmed → Shipped → Delivered / Cancelled) and an internal note, **Product** editor (price, old price, availability, colors, all customer-facing copy, FAQs) and **Store settings** (site name, phone, WhatsApp, email, hours, address, currency, delivery fee, free-delivery threshold, service area, delivery estimate, returns policy, consent text, announcement bar, accent color). Saving updates the live store immediately.

Stack: Next.js 15 (App Router, server actions) · React 19 · libSQL (SQLite locally, Turso in production) · plain CSS. No client-side secrets; no card payments.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run hash-password            # prints ADMIN_PASSWORD_HASH=scrypt:...
# paste that line into .env.local, and add a SESSION_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
npm run dev                      # http://localhost:3000  and  /admin
```

The local database is created automatically at `data/promax.db`.

**Before the store takes orders**, sign in to `/admin` and set the **price** (Product) and **currency code** (Store settings). Until both are set the order form shows “ordering not available yet” and the admin shows a setup checklist.

## Environment variables

| Name | Required | What it is |
| --- | --- | --- |
| `ADMIN_PASSWORD_HASH` | yes | Output of `npm run hash-password`. The plain password is never stored. Changing it signs out every session. |
| `SESSION_SECRET` | yes | Random string, 32+ characters. Signs the admin session cookie. |
| `DATABASE_URL` or `TURSO_DATABASE_URL` | production | `libsql://…` URL of a hosted libSQL database. Defaults to `file:./data/promax.db` locally. |
| `DATABASE_AUTH_TOKEN` or `TURSO_AUTH_TOKEN` | production | Token for that database. |

## Deploy on Vercel

1. Import this repository into the Vercel project.
2. **Storage → Create database → Turso** (Marketplace). It adds `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to the project. (Any libSQL URL works via `DATABASE_URL`/`DATABASE_AUTH_TOKEN`.)
3. Add `ADMIN_PASSWORD_HASH` and `SESSION_SECRET` under **Settings → Environment Variables**.
4. Deploy. Tables are created on first request.

Vercel's filesystem is read-only, so the local SQLite file cannot be used in production.

## How orders are stored and the admin is secured

- Orders are written by a server action to the `orders` table. Price, delivery fee and total are recomputed on the server from the saved product/settings; nothing the browser sends about money is trusted. Each form view carries a one-time key, so double taps and retries return the same order instead of creating duplicates. A hidden honeypot field and a light per-instance rate limit slow down spam.
- Admin sign-in compares the password against an scrypt hash from the environment and sets an HTTP-only, `SameSite=Strict`, HMAC-signed session cookie (12 h). Every admin page **and** every admin server action calls `requireAdmin()` on the server. Failed sign-ins are throttled per IP (8 per 15 minutes). There are no default credentials: without the env vars, sign-in is disabled and says why.
- Admin pages are `noindex` and `no-store`.

## Replacing product photos

See `public/product/README.md`. Photos are pre-sized WebP files referenced from `src/app/(store)/ProductPicture.tsx`.

## Project layout

```
src/app/(store)/      Arabic storefront: page, order form + server action, styles
src/app/admin/        Admin: login, (panel)/orders, product, settings, actions
src/lib/content.ts    Content types, defaults, money helpers
src/lib/db.ts         libSQL client, schema, queries
src/lib/auth.ts       Password check, signed session cookie, requireAdmin()
src/lib/validation.ts Order validation (shared by browser and server)
scripts/hash-password.mjs
```

## Owner to confirm

These are left empty or neutral on purpose until you provide them (all editable in the admin):

- Price, old price (if any) and currency
- Delivery fee, free-delivery threshold, service area, delivery estimate
- Support phone / WhatsApp (international format) / email / hours
- Returns and exchange policy
- Exact box contents (“What's in the box” stays hidden while empty; the photos show 4 blade discs, a dicing grid, a lid with chute and a pusher)
- Wattage, capacity or warranty, if you want them listed (not shown on the box artwork, so not claimed)

## Known limitations

- The order spam limit is per server instance, not global.
- Admin dates show in the server's time zone (UTC on Vercel).
- Product photos are replaced by file, not uploaded through the admin.
