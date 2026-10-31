/**
 * Defer images rendered from Markdown / MDX until they approach the viewport.
 * This doesn't compress image bytes; image conversion is a separate task.
 * Only set defaults so explicit author-specified loading is preserved.
 */
export default function rehypeLazyImages() {
  return (tree) => {
    const visit = (node) => {
      if (node.type === 'element' && node.tagName === 'img') {
        node.properties ??= {};
        node.properties.loading ??= 'lazy';
        node.properties.decoding ??= 'async';
      }

      if (Array.isArray(node.children)) {
        for (const child of node.children) visit(child);
      }
    };

    visit(tree);
  };
}
