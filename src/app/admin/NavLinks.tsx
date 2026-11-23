"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IcBox, IcGear, IcOrders, IcStore } from "./icons";

const LINKS = [
  { href: "/admin", label: "الطلبات", Icon: IcOrders, match: (p: string) => p === "/admin" || p.startsWith("/admin/orders") },
  { href: "/admin/product", label: "المنتج", Icon: IcBox, match: (p: string) => p.startsWith("/admin/product") },
  { href: "/admin/settings", label: "الإعدادات", Icon: IcGear, match: (p: string) => p.startsWith("/admin/settings") },
];

export function NavLinks({ compact = false }: { compact?: boolean }) {
  const path = usePathname() ?? "/admin";
  return (
    <div className={compact ? "tabbar-links" : "side-nav"}>
      {LINKS.map(({ href, label, Icon, match }) => (
        <Link key={href} href={href} className="nav-link" aria-current={match(path) ? "page" : undefined}>
          <Icon />
          <span>{label}</span>
        </Link>
      ))}
      <a href="/" target="_blank" rel="noopener" className="nav-link">
        <IcStore />
        <span>{compact ? "المتجر" : "عرض المتجر"}</span>
      </a>
    </div>
  );
}
