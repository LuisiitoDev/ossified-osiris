import { responsiveImageAttributes } from '../utils/imageCdn.mjs';

/**
 * Defer offscreen Markdown images and use Netlify Image CDN variants in
 * Netlify builds. Regular Astro local development retains original paths.
 */
export default function rehypeLazyImages(options = {}) {
  return (tree) => {
    const visit = (node) => {
      if (node.type === 'element' && node.tagName === 'img') {
        node.properties ??= {};
        node.properties.loading ??= 'lazy';
        node.properties.decoding ??= 'async';

        if (!node.properties.srcSet && !node.properties.srcset) {
          const result = responsiveImageAttributes(node.properties.src, {
            ...options,
            widths: [480, 800, 1280, 1600],
            sizes: '(max-width: 768px) 100vw, 800px',
          });
          node.properties.src = result.src;
          if (result.srcset) node.properties.srcSet = result.srcset;
          if (result.sizes) node.properties.sizes = result.sizes;
        }
      }

      if (Array.isArray(node.children)) {
        for (const child of node.children) visit(child);
      }
    };
    visit(tree);
  };
}
