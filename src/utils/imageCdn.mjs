/**
 * Generate responsive Netlify Image CDN URLs for static images in public/.
 * Only active for Netlify builds. Locally Astro serves the original source.
 * Source files remain untouched and usable as public / Open Graph URLs.
 */
export const shouldUseImageCdn = process.env.NETLIFY === 'true';

export function isLocalRasterImage(src) {
  return typeof src === 'string' &&
    src.startsWith('/') &&
    !src.startsWith('//') &&
    !src.includes('?') &&
    !src.includes('#') &&
    /\.(?:png|jpe?g|webp)$/i.test(src);
}

/**
 * Same-origin, size-bounded image URL for assets used outside <img> srcset,
 * e.g. an HTML canvas or a CSS background. Local dev retains the original.
 */
export function imageCdnUrl(src, {
  width,
  quality = 75,
  enabled = shouldUseImageCdn,
} = {}) {
  if (!enabled || !isLocalRasterImage(src) ||
      !Number.isInteger(width) || width < 1 || width > 4096) return src;
  const safeQuality = Number.isInteger(quality) && quality >= 1 && quality <= 100
    ? quality : 75;
  return `/.netlify/images?url=${encodeURIComponent(src)}&w=${width}&q=${safeQuality}`;
}

export function responsiveImageAttributes(src, {
  widths = [480, 960, 1600],
  sizes = '(max-width: 768px) 100vw, 800px',
  quality = 75,
  enabled = shouldUseImageCdn,
} = {}) {
  if (!enabled || !isLocalRasterImage(src)) {
    return { src };
  }

  const validWidths = [...new Set(widths)]
    .filter((width) => Number.isInteger(width) && width > 0)
    .sort((a, b) => a - b);

  if (validWidths.length === 0) {
    return { src };
  }

  const safeQuality = Number.isInteger(quality) && quality >= 1 && quality <= 100 ? quality : 75;
  const urlFor = (width) => imageCdnUrl(src, { width, quality: safeQuality, enabled });

  return {
    src: urlFor(validWidths[validWidths.length - 1]),
    srcset: validWidths.map((width) => `${urlFor(width)} ${width}w`).join(', '),
    sizes,
  };
}
