import { randomUUID } from "node:crypto";
import { getOffers, getProduct, getSettings } from "@/lib/db";
import { DEFAULT_PRODUCT, DEFAULT_SETTINGS, DELIVERY_ZONES, formatMoney, liveOffers, offerEndMs, type Offer, orderingOpen, toCents, zoneFee } from "@/lib/content";
import { ProductPicture } from "./ProductPicture";
import { OrderForm } from "./OrderForm";
import { ColorShowcase, RevealController, StickyOrder } from "./client";
import { ProductStage } from "./stage/ProductStage";
import { DiscRing, Spotlight } from "./showcase";
import { OffersSection, type OfferView } from "./offers";
import { CallIcon, CashIcon, CheckIcon, PhoneIcon, TruckIcon, WhatsAppIcon } from "./icons";

export default async function Home() {
  let product = DEFAULT_PRODUCT;
  let settings = DEFAULT_SETTINGS;
  let offers: Offer[] = [];
  let dbError = false;
  try {
    [product, settings, offers] = await Promise.all([getProduct(), getSettings(), getOffers()]);
  } catch (err) {
    console.error("storefront: could not load content:", (err as Error)?.message ?? err);
    dbError = true;
  }

  const open = !dbError && orderingOpen(product, settings);
  const priceSet = product.price > 0 && settings.currencyCode;
  // the admin can show a different "regular" price in the hero (e.g. price incl. delivery)
  const shownPrice = settings.displayPrice > 0 ? settings.displayPrice : product.price;
  let price = priceSet ? formatMoney(toCents(shownPrice), settings.currencyCode) : "";
  let compare =
    priceSet && product.compareAtPrice > shownPrice
      ? formatMoney(toCents(product.compareAtPrice), settings.currencyCode)
      : "";
  const zones = DELIVERY_ZONES.filter((z) => z.key === "inside" || settings.westBankEnabled).map((z) => ({ key: z.key, label: z.label, feeCents: zoneFee(settings, z.key) }));
  const feeText = !settings.currencyCode
    ? ""
    : "رسوم التوصيل: " +
      zones.map((z) => `${z.label} ${z.feeCents ? formatMoney(z.feeCents, settings.currencyCode) : "مجاني"}`).join("، ") +
      (settings.freeDeliveryFrom > 0
        ? `. مجاني للطلبات من ${formatMoney(toCents(settings.freeDeliveryFrom), settings.currencyCode)}`
        : "");
  const offerViews: OfferView[] = open
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
  // when an offer is on, the hero shows the same price as the offer card
  const heroOffer = offerViews[0];
  let priceLabel = settings.priceLabel.trim();
  if (heroOffer) {
    price = formatMoney(heroOffer.priceCents, settings.currencyCode);
    compare = "";
    priceLabel = [heroOffer.quantity > 1 ? `${heroOffer.quantity} قطع` : "", heroOffer.includesDelivery ? "مع التوصيل" : ""].filter(Boolean).join(" · ");
  }
  const phone = settings.supportPhone.trim();
  const whatsapp = settings.whatsappNumber.replace(/[^\d]/g, "");
  const waLink = settings.showWhatsappButton && whatsapp.length >= 8 ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`مرحباً ${settings.storeName}، عندي سؤال`)}` : "";
  const accent = /^#[0-9a-fA-F]{6}$/.test(settings.accentColor) ? settings.accentColor : DEFAULT_SETTINGS.accentColor;
  const colorPhotoAlt: Record<string, string> = {
    black: `${product.name} باللون الأسود مع الأقراص والملحقات`,
    beige: `${product.name} باللون البيج مع الأقراص والملحقات`,
  };

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
        {/* 1. Opening scene */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-stage">
            <ProductStage colors={product.colors} accent={accent} name={product.name} />
          </div>
          <div className="hero-copy">
            <p className="eyebrow">
              <span dir="ltr">{settings.storeName}</span> <span aria-hidden>·</span> <span dir="ltr">{product.modelNumber}</span>
            </p>
            <h1 id="hero-title">
              {product.headline.includes("7 في 1") ? (
                <>
                  <span className="h1-line">{product.headline.replace("7 في 1", "").trim()}</span>
                  <span className="seven">
                    7<small>في</small>1
                  </span>
                </>
              ) : (
                product.headline
              )}
            </h1>
            {product.subheadline && <p className="lede">{product.subheadline}</p>}

            <div className="price-row">
              {price ? (
                <>
                  <span className="price-block">
                    {priceLabel && <small className="price-label">{priceLabel}</small>}
                    <span className="price">{price}</span>
                  </span>
                  {compare && (
                    <s className="compare" aria-label={`السعر السابق ${compare}`}>
                      {compare}
                    </s>
                  )}
                </>
              ) : (
                <span className="price price-pending">السعر يُعلن قريباً</span>
              )}
              <span className="cod-pill">
                <CashIcon /> الدفع عند الاستلام
              </span>
            </div>

            <div className="hero-actions" id="hero-cta">
              <a className="btn btn-primary btn-large" href="#order">
                {open ? "اطلب الآن" : "تواصل معنا للطلب"}
              </a>
              {product.keyBenefit && <p className="key-benefit">{product.keyBenefit}</p>}
            </div>
            {product.availability === "sold_out" && <p className="stock-note">نفدت الكمية حالياً.</p>}
          </div>
          <a href="#gallery-title" className="scroll-cue" aria-label="اكتشف المزيد">
            <span aria-hidden />
          </a>
        </section>

        {/* uses strip */}
        {product.uses.length > 0 && (
          <section className="uses" aria-label="ماذا تقطّع">
            <ul>
              {product.uses.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </section>
        )}

        <OffersSection offers={offerViews} currency={settings.currencyCode} />

        <Spotlight src="/product/cut-black.webp" alt={`${product.name} باللون الأسود من قريب`} />

        {/* 3. Cinematic presentation */}
        <section className="gallery" aria-labelledby="gallery-title">
          <div className="gallery-copy" data-reveal>
            <p className="eyebrow">لونان مميزان</p>
            <h2 id="gallery-title">اختر لون مطبخك.</h2>
            <p className="gallery-text">صورتان حقيقيتان للجهاز مع الأقراص الأربعة وشبكة التقطيع. اختر اللون لتراه.</p>
          </div>
          <div data-reveal>
            <ColorShowcase
              colors={product.colors}
              photos={{
                black: <ProductPicture slug="black" sizes="(min-width: 960px) 45vw, 100vw" alt={colorPhotoAlt.black} />,
                beige: <ProductPicture slug="beige" sizes="(min-width: 960px) 45vw, 100vw" alt={colorPhotoAlt.beige} />,
              }}
            />
          </div>
        </section>

        <DiscRing />


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

          {product.faqs.length > 0 && (
            <div className="faq" data-reveal>
              <h2 id="faq-title">أسئلة شائعة</h2>
              {product.faqs.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          )}
        </section>

        {/* 6. Order */}
        <section className="order" id="order" aria-labelledby="order-title">
          <div className="order-intro">
            <p className="eyebrow">اطلب الآن</p>
            <h2 id="order-title">أكمل طلبك</h2>
            <div className="order-product">
              <ProductPicture slug="duo" sizes="120px" alt="" className="order-thumb" />
              <div>
                <strong>{product.name}</strong>
                <span>{price || "السعر يُعلن قريباً"}</span>
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

      <StickyOrder price={price || "اطلب الآن"} open={open} />
    </div>
  );
}
