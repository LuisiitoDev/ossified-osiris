/**
 * Use Astro's actual rendered Markdown/MDX headings, not regexes over source.
 * Skip H1 (the article layout owns it) and headings deeper than H3.
 * Keep order/anchors identical to those emitted by Astro.
 */
export function getTocHeadings(headings = []) {
  return headings.filter(
    (heading) =>
      (heading.depth === 2 || heading.depth === 3) &&
      typeof heading.slug === 'string' &&
      heading.slug.length > 0 &&
      typeof heading.text === 'string' &&
      heading.text.trim().length > 0
  );
}

export function showTableOfContents(headings = []) {
  // Short pieces don't need navigation taking up reading space.
  return getTocHeadings(headings).length >= 3;
}
