/**
 * Static metadata search for LuisiitoDev articles.
 * Works entirely in the browser: no backend, API keys, or third-party search.
 */
export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function rankArticles(articles, query) {
  const normalizedQuery = normalizeSearchText(String(query ?? '').slice(0, 120));
  const terms = normalizedQuery.split(' ').filter(Boolean);

  return articles
    .map((article) => {
      const title = normalizeSearchText(article.title);
      const description = normalizeSearchText(article.description);
      const tags = normalizeSearchText(
        Array.isArray(article.tags) ? article.tags.join(' ') : ''
      );
      const allText = [title, description, tags].join(' ');

      if (terms.some((term) => !allText.includes(term))) {
        return null;
      }

      const score = terms.reduce(
        (total, term) =>
          total +
          (title.includes(term) ? 4 : 0) +
          (tags.includes(term) ? 3 : 0) +
          (description.includes(term) ? 1 : 0),
        normalizedQuery && title === normalizedQuery ? 6 : 0
      );

      return { article, score };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const dateA = new Date(a.article.pubDate).valueOf() || 0;
      const dateB = new Date(b.article.pubDate).valueOf() || 0;
      return (
        b.score - a.score ||
        dateB - dateA ||
        String(a.article.id).localeCompare(String(b.article.id))
      );
    })
    .map(({ article }) => article);
}
