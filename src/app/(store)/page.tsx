import { randomUUID } from "node:crypto";
import { getOffers, getProduct, getRack, getSettings } from "@/lib/db";
import { DEFAULT_PRODUCT, DEFAULT_RACK, DEFAULT_SETTINGS, rackOrderable, DELIVERY_ZONES, formatMoney, liveOffers, offerEndMs, type Offer, orderingOpen, toCents, zoneFee } from "@/lib/content";
import { OrderForm } from "./OrderForm";
import { RevealController, StickyOrder } from "./client";
import { type OfferView } from "./offers";
import { HeroShowcase, RackSection, SaladSimple, type RackView } from "./rack";
import { CallIcon, CashIcon, CheckIcon, PhoneIcon, TruckIcon, WhatsAppIcon } from "./icons";

export default async function Home() {
  let product = DEFAULT_PRODUCT;
  let settings = DEFAULT_SETTINGS;
  let offers: Offer[] = [];
  let rack = DEFAULT_RACK;
  let dbError = false;
  try {
    [product, settings, offers, rack] = await Promise.all([getProduct(), getSettings(), getOffers(), getRack()]);
  } catch (err) {
    console.error("storefront: could not load content:", (err as Error)?.message ?? err);
    dbError = true;
  }

  const saladOpen = !dbError && orderingOpen(product, settings);
  const rackOpen = !dbError && rackOrderable(rack, settings);
  const showRack = !dbError && rack.enabled;
  // the order form is open when either product can be ordered
  const open = saladOpen || rackOpen;
  const rackPrice = rack.price > 0 && settings.currencyCode ? formatMoney(toCents(rack.price), settings.currencyCode) : "";
  const rackView: RackView = {
    name: rack.name,
    priceCents: toCents(rack.price),
    orderable: rackOpen,
    headline: rack.headline,
    intro: rack.intro,
    featuresTitle: rack.featuresTitle,
    features: rack.features,
    outro: rack.outro,
  };
  const priceSet = product.price > 0 && settings.currencyCode;
  // the admin can show a different "regular" price in the hero (e.g. price incl. delivery)
  const shownPrice = settings.displayPrice > 0 ? settings.displayPrice : product.price;
  let price = priceSet ? formatMoney(toCents(shownPrice), settings.currencyCode) : "";
  const zones = DELIVERY_ZONES.filter((z) => z.key === "inside" || settings.westBankEnabled).map((z) => ({ key: z.key, label: z.label, feeCents: zoneFee(settings, z.key) }));
  const feeText = !settings.currencyCode
    ? ""
    : "رسوم التوصيل: " +
      zones.map((z) => `${z.label} ${z.feeCents ? formatMoney(z.feeCents, settings.currencyCode) : "مجاني"}`).join("، ") +
      (settings.freeDeliveryFrom > 0
        ? `. مجاني للطلبات من ${formatMoney(toCents(settings.freeDeliveryFrom), settings.currencyCode)}`
        : "");
  const offerViews: OfferView[] = saladOpen
    ? liveOffers(offers).map((o) => ({
        id: o.id,
        title: o.title,
        quantity: o.quantity,
        priceCents: toCents(o.price),
        includesDelivery: o.includesDelivery,
        badge: o.badge,
        theme: o.theme,
        endsAt: o.endsAt ? offerEndMs(o.endsAt) : 0,
        // what the same devices cost at the regular price, delivery inside included
        normalCents: !settings.showOfferDiscount
          ? 0
          : settings.displayPrice > 0
            ? toCents(settings.displayPrice) * o.quantity
            : toCents(product.price) * o.quantity +
              (o.includesDelivery && !settings.priceIncludesDelivery ? toCents(settings.deliveryFee) : 0),
      }))
    : [];
  // when an offer is on, the salad maker card shows the offer price
  const heroOffer = offerViews[0];
  if (heroOffer) price = formatMoney(heroOffer.priceCents, settings.currencyCode);
  const phone = settings.supportPhone.trim();
  const whatsapp = settings.whatsappNumber.replace(/[^\d]/g, "");
  const waLink = settings.showWhatsappButton && whatsapp.length >= 8 ? `https://api.whatsapp.com/send?phone=${whatsapp}&text=${encodeURIComponent(`مرحباً ${settings.storeName}، عندي سؤال`)}` : "";
  const accent = /^#[0-9a-fA-F]{6}$/.test(settings.accentColor) ? settings.accentColor : DEFAULT_SETTINGS.accentColor;

  return (
    <div style={{ ["--accent" as string]: accent }}>
      <a className="skip" href="#order">
        انتقل إلى نموذج الطلب
      </a>
      <RevealController />

      {settings.announcement && <div className="announce">{settings.announcement}</div>}

      <header className="topbar">
        <a href="#top" className="wordmark" aria-label={settings.storeName}>
          <span className="wordmark-mark" aria-hidden>
            P
          </span>
          <span dir="ltr">{settings.storeName}</span>
        </a>
        <nav className="topbar-actions" aria-label="روابط سريعة">
          {phone && (
            <a className="topbar-phone" href={`tel:${phone}`}>
              <PhoneIcon />
              <span dir="ltr">{phone}</span>
            </a>
          )}
          <a className="btn btn-small btn-primary" href="#order">
            اطلب الآن
          </a>
        </nav>
      </header>

      <main id="top">
        {/* 1. Opening scene: the drying rack first, the salad maker one tap away */}
        <HeroShowcase
          storeName={settings.storeName}
          contactHref={waLink}
          rackName={rack.name}
          items={[
            ...(showRack ? [{ key: "rack" as const, tab: "منشر الغسيل", name: rack.name, lede: rack.intro, price: rackPrice, orderable: rackOpen }] : []),
            { key: "salad" as const, tab: "ماكنة السلطة", name: product.name, lede: product.subheadline, price, orderable: saladOpen },
          ]}
        />

        {showRack && <RackSection r={rackView} />}

        {/* the salad maker: simple, just to buy */}
        <SaladSimple name={product.name} sub={product.subheadline} price={price} badge={offerViews[0]?.title ?? ""} open={saladOpen} />

        {/* 4. Delivery & COD */}
        <section className="delivery" aria-labelledby="delivery-title">
          <div data-reveal>
            <p className="eyebrow">التوصيل والدفع</p>
            <h2 id="delivery-title">اطلب الآن، وادفع عند الاستلام.</h2>
          </div>
          <ol className="steps">
            <li data-reveal>
              <span className="step-icon">
                <CheckIcon />
              </span>
              <h3>اطلب في دقيقة</h3>
              <p>اكتب اسمك ورقمك وعنوانك فقط. بدون حساب وبدون بطاقة.</p>
            </li>
            <li data-reveal style={{ ["--d" as string]: "80ms" }}>
              <span className="step-icon">
                <CallIcon />
              </span>
              <h3>نتصل لتأكيد الطلب</h3>
              <p>نراجع معك اللون والكمية والعنوان قبل الشحن.</p>
            </li>
            <li data-reveal style={{ ["--d" as string]: "160ms" }}>
              <span className="step-icon">
                <TruckIcon />
              </span>
              <h3>التوصيل</h3>
              <p>
                {settings.deliveryEstimate ? `خلال ${settings.deliveryEstimate}.` : "نخبرك بموعد التوصيل عند التأكيد."}
                {settings.serviceArea && <> نوصّل إلى: {settings.serviceArea}.</>}
              </p>
            </li>
            <li data-reveal style={{ ["--d" as string]: "240ms" }}>
              <span className="step-icon">
                <CashIcon />
              </span>
              <h3>ادفع نقداً عند الاستلام</h3>
              <p>{feeText ? (feeText.endsWith(".") ? feeText : `${feeText}.`) : "تُحدَّد رسوم التوصيل عند تأكيد الطلب."}</p>
            </li>
          </ol>
        </section>

        {/* 5. Trust & FAQ */}
        <section className="trust" aria-labelledby="faq-title">
          <div className="trust-cards">
            <div data-reveal>
              <h3>الاستبدال والإرجاع</h3>
              <p>{settings.returnsPolicy || "للاستفسار عن الاستبدال أو الإرجاع، تواصل معنا وسنساعدك."}</p>
            </div>
            <div data-reveal>
              <h3>الدعم</h3>
              {phone || whatsapp ? (
                <ul className="contact-list">
                  {phone && (
                    <li>
                      هاتف: <a href={`tel:${phone}`} dir="ltr">{phone}</a>
                    </li>
                  )}
                  {whatsapp && (
                    <li>
                      واتساب:{" "}
                      <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" dir="ltr">
                        +{whatsapp}
                      </a>
                    </li>
                  )}
                  {settings.supportHours && <li>{settings.supportHours}</li>}
                </ul>
              ) : (
                <p>سنتواصل معك هاتفياً بعد استلام طلبك.</p>
              )}
            </div>
          </div>

        </section>

        {/* 6. Order */}
        <section className="order" id="order" aria-labelledby="order-title">
          <div className="order-intro">
            <p className="eyebrow">اطلب الآن</p>
            <h2 id="order-title">أكمل طلبك</h2>
            <div className="order-product">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/product/rack/open-720.webp" alt="" width={120} height={77} className="order-thumb order-thumb-rack" />
              <div>
                <strong>{rack.name}</strong>
                <span>{rackPrice || "السعر يُعلن قريباً"}</span>
              </div>
            </div>
            <ul className="order-points">
              <li>
                <CheckIcon /> الدفع نقداً عند الاستلام
              </li>
              <li>
                <CheckIcon /> نتصل بك لتأكيد الطلب قبل الشحن
              </li>
              {settings.deliveryEstimate && (
                <li>
                  <CheckIcon /> التوصيل خلال {settings.deliveryEstimate}
                </li>
              )}
            </ul>
          </div>
          <div className="order-card">
            {dbError ? (
              <div className="order-closed" role="alert">
                <h3>تعذّر تحميل نموذج الطلب</h3>
                <p>حدّث الصفحة بعد قليل{phone ? <> أو اتصل بنا على <a href={`tel:${phone}`} dir="ltr">{phone}</a></> : ""}.</p>
              </div>
            ) : (
              <OrderForm
                idempotencyKey={randomUUID()}
                open={open}
                unitCents={toCents(product.price)}
                currency={settings.currencyCode}
                zones={zones}
                freeDeliveryFromCents={toCents(settings.freeDeliveryFrom)}
                maxPerOrder={product.maxPerOrder}
                colors={product.colors}
                supportPhone={phone}
                deliveryEstimate={settings.deliveryEstimate}
                offers={offerViews}
                saladOpen={saladOpen}
                rack={showRack ? { name: rack.name, priceCents: toCents(rack.price), maxPerOrder: rack.maxPerOrder, orderable: rackOpen } : null}
                whatsappCheckout={settings.whatsappCheckout && whatsapp.length >= 8}
              />
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div>
          <strong dir="ltr">{settings.storeName}</strong>
          {settings.tagline && <span> — {settings.tagline}</span>}
        </div>
        <p className="muted">
          © {new Date().getFullYear()} {settings.storeName}
        </p>
        <p className="footer-credit">
          Built by{" "}
          <a href="https://www.instagram.com/mahdi_qaddah/" target="_blank" rel="noopener noreferrer" dir="ltr">
            @mahdi_qaddah
          </a>
        </p>
      </footer>


      {waLink && (
        <a className="wa-float" href={waLink} target="_blank" rel="noopener noreferrer" aria-label="راسلنا على واتساب">
          <span className="wa-float-ring" aria-hidden />
          <WhatsAppIcon />
          <span className="wa-float-text">راسلنا</span>
        </a>
      )}

      <StickyOrder price={rackPrice || price || "اطلب الآن"} open={open} />
    </div>
  );
}
