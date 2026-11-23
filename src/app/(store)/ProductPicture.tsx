// Responsive product photo from /public/product. To replace a photo, overwrite
// the files named <slug>-<width>.webp (see public/product/README.md).

export const PHOTOS = {
  duo: { widths: [480, 788], w: 788, h: 670 },
  beige: { widths: [480, 800, 1122], w: 1122, h: 1402 },
  black: { widths: [480, 800, 1122], w: 1122, h: 1402 },
  "poster-ar": { widths: [480, 800, 1122], w: 1122, h: 1402 },
  "poster-en": { widths: [480, 800, 1122], w: 1122, h: 1402 },
} as const;

export type PhotoSlug = keyof typeof PHOTOS;

export function ProductPicture({
  slug,
  alt,
  sizes,
  priority = false,
  className,
}: {
  slug: PhotoSlug;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const p = PHOTOS[slug];
  const largest = p.widths[p.widths.length - 1];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={`/product/${slug}-${largest}.webp`}
      srcSet={p.widths.map((w) => `/product/${slug}-${w}.webp ${w}w`).join(", ")}
      sizes={sizes}
      width={p.w}
      height={p.h}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );
}
