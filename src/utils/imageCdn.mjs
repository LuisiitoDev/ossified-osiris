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
  const urlFor = (width) =>
    `/.netlify/images?url=${encodeURIComponent(src)}&w=${width}&q=${safeQuality}`;

  return {
    src: urlFor(validWidths[validWidths.length - 1]),
    srcset: validWidths.map((width) => `${urlFor(width)} ${width}w`).join(', '),
    sizes,
  };
}
