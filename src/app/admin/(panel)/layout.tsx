import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { logout } from "../actions";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  let storeName = "Store";
  try {
    storeName = (await getSettings()).storeName;
  } catch {
    /* page below shows the DB error */
  }
  return (
    <div className="panel">
      <header className="panel-top">
        <div className="panel-brand">
          <span className="panel-mark" aria-hidden>
            P
          </span>
          {storeName} <span className="muted">admin</span>
        </div>
        <nav aria-label="Admin">
          <Link href="/admin">Orders</Link>
          <Link href="/admin/product">Product</Link>
          <Link href="/admin/settings">Store settings</Link>
          <a href="/" target="_blank" rel="noopener">
            View store ↗
          </a>
        </nav>
        <form action={logout}>
          <button type="submit" className="a-btn a-btn-ghost">
            Sign out
          </button>
        </form>
      </header>
      <main className="panel-main">{children}</main>
    </div>
  );
}
