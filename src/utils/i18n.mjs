// Keep the English routes stable. Spanish pages use /es/.
// Only list a post when an actual translated Markdown page has been published.
export const translatedArticleSlugs = new Set(['howigotmygithubactionscert', 'howigetmyazurecert', 'hellofriend', 'extendedmethods', 'mcp', 'sql-database-devops']);

export function localeFromPath(pathname) {
  return /^\/es(?:\/|$)/.test(pathname || '') ? 'es' : 'en';
}

export function localeRoute(path, locale = 'en') {
  const clean = '/' + String(path).replace(/^\/+|\/+$/g, '');
  const base = clean === '/' ? '/' : clean + '/';
  return locale === 'es' ? (base === '/' ? '/es/' : '/es' + base) : base;
}

export function articleRoute(postId, locale = 'en') {
  const id = String(postId).replace(/^es\//, '');
  return localeRoute(id, locale === 'es' && translatedArticleSlugs.has(id) ? 'es' : 'en');
}

export function alternateLocaleRoute(pathname) {
  const locale = localeFromPath(pathname);
  const without = locale === 'es' ? pathname.replace(/^\/es(?=\/|$)/, '') || '/' : pathname;
  if (locale === 'es') return localeRoute(without, 'en');
  if (without === '/' || /^\/(?:about|search)\/?$/.test(without) ||
      /^\/topics\/[^/]+\/?$/.test(without)) return localeRoute(without, 'es');
  const slug = without.replace(/^\/+|\/+$/g, '');
  return translatedArticleSlugs.has(slug) ? articleRoute(slug, 'es') : '/es/';
}

export function localizedAlternates(pathname) {
  const locale = localeFromPath(pathname);
  const without = locale === 'es' ? pathname.replace(/^\/es(?=\/|$)/, '') || '/' : pathname;
  if (without === '/' || /^\/about\/?$/.test(without) ||
      /^\/topics\/[^/]+\/?$/.test(without)) return {
        en: localeRoute(without, 'en'), es: localeRoute(without, 'es'),
      };
  const slug = without.replace(/^\/+|\/+$/g, '');
  if (translatedArticleSlugs.has(slug)) return {
    en: articleRoute(slug, 'en'), es: articleRoute(slug, 'es'),
  };
  return null;
}

export const labels = {
  en: {
    skip: 'Skip to main content', navigation: 'Main navigation', home: 'Home',
    about: 'About', language: 'Language', search: 'Search articles',
    rss: 'RSS feed', rights: 'All rights reserved.',
    browse: 'Browse topics', all: 'All articles', read: 'Read Articles',
    latest: 'Latest Publications', featured: 'FEATURED POST',
    searchButton: 'Search', searchPlaceholder: 'Search articles...',
    searchLabel: 'Search blog articles',
  },
  es: {
    skip: 'Saltar al contenido principal', navigation: 'Navegación principal',
    home: 'Inicio', about: 'Acerca de mí', language: 'Idioma',
    search: 'Buscar artículos', rss: 'Fuente RSS', rights: 'Todos los derechos reservados.',
    browse: 'Explorar temas', all: 'Todos los artículos', read: 'Leer artículos',
    latest: 'Publicaciones recientes', featured: 'ARTÍCULO DESTACADO',
    searchButton: 'Buscar', searchPlaceholder: 'Buscar artículos...',
    searchLabel: 'Buscar artículos del blog',
  },
};
