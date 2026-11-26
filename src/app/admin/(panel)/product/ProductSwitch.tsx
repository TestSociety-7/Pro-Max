import Link from "next/link";

/** Picks which of the two products the page edits. */
export function ProductSwitch({ current }: { current: "salad" | "rack" }) {
  return (
    <nav className="product-switch" aria-label="اختر المنتج">
      <Link href="/admin/product" aria-current={current === "salad" ? "page" : undefined}>
        ماكنة السلطة
      </Link>
      <Link href="/admin/product/rack" aria-current={current === "rack" ? "page" : undefined}>
        منشر الغسيل
      </Link>
    </nav>
  );
}
