import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { logout } from "../actions";
import { LiveTools } from "../LiveTools";
import { NavLinks } from "../NavLinks";
import { IcLogout } from "../icons";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  let storeName = "Pro Max";
  try {
    storeName = (await getSettings()).storeName || storeName;
  } catch {
    /* the page below shows a friendly message */
  }
  return (
    <div className="panel">
      <aside className="side">
        <div className="side-brand">
          <span className="brand-cube" aria-hidden>
            P
          </span>
          <span>
            <strong dir="auto">{storeName}</strong>
            <small>لوحة التحكم</small>
          </span>
        </div>
        <NavLinks />
        <form action={logout} className="side-out">
          <button type="submit" className="nav-link">
            <IcLogout />
            <span>تسجيل الخروج</span>
          </button>
        </form>
      </aside>

      <div className="panel-body">
        <header className="panel-top">
          <div className="top-brand">
            <span className="brand-cube" aria-hidden>
              P
            </span>
            <strong dir="auto">{storeName}</strong>
          </div>
          <LiveTools />
          <form action={logout} className="top-out">
            <button type="submit" className="icon-btn" aria-label="تسجيل الخروج">
              <IcLogout />
            </button>
          </form>
        </header>
        <main className="panel-main">{children}</main>
      </div>

      <nav className="tabbar" aria-label="التنقل">
        <NavLinks compact />
      </nav>
    </div>
  );
}
