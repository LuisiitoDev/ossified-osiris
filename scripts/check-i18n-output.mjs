import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { translatedArticleSlugs } from '../src/utils/i18n.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const base = 'https://luisiitodev.com';
const html = (route) => {
  const path = route === '/' ? join(dist, 'index.html') : join(dist, route.slice(1), 'index.html');
  assert.ok(existsSync(path), 'Missing generated route: ' + route);
  return readFileSync(path, 'utf8');
};

function validateLocalePair(route) {
  const english = html(route);
  const spanish = html(route === '/' ? '/es/' : '/es' + route);
  const englishUrl = base + route;
  const spanishUrl = base + (route === '/' ? '/es/' : '/es' + route);

  for (const [page, locale, canonical] of [
    [english, 'en', englishUrl],
    [spanish, 'es', spanishUrl],
  ]) {
    assert.match(page, new RegExp('<html[^>]*\\blang="' + locale + '"'), 'Wrong document language: ' + canonical);
    assert.ok(page.includes('href="' + canonical + '"'), 'Missing canonical URL: ' + canonical);
    assert.ok(page.includes('hreflang="en" href="' + englishUrl + '"'), 'Missing English alternate: ' + canonical);
    assert.ok(page.includes('hreflang="es" href="' + spanishUrl + '"'), 'Missing Spanish alternate: ' + canonical);
    assert.ok(page.includes('hreflang="x-default" href="' + englishUrl + '"'), 'Wrong x-default: ' + canonical);
    assert.ok(page.includes('content="' + (locale === 'en' ? 'en_US' : 'es_CR') + '"'), 'Wrong OG locale: ' + canonical);
    assert.ok(page.includes('href="' + (locale === 'en' ? '/rss.xml' : '/es/rss.xml') + '"'),
      'Wrong-language RSS link: ' + canonical);
  }
}

const translationsDir = join(root, 'src/content/blog/es');
const translated = readdirSync(translationsDir).filter((x) => /\.mdx?$/.test(x));
assert.equal(translated.length, 10, 'Expected 10 full Spanish article translations');

for (const filename of translated) {
  const slug = filename.replace(/\.mdx?$/, '').toLowerCase();
  assert.ok(translatedArticleSlugs.has(slug), 'Missing translated article registration: ' + slug);
  validateLocalePair('/' + slug + '/');
}
validateLocalePair('/');
validateLocalePair('/about/');

const esHome = html('/es/');
assert.ok(esHome.includes('Publicaciones recientes'), 'Spanish homepage text absent');
assert.ok(esHome.includes('href="/es/mcp/"'), 'Spanish MCP link absent');
assert.ok(esHome.includes('href="/es/about/"'), 'Spanish About link absent');

const enHome = html('/');
assert.ok(enHome.includes('Latest Publications'), 'English homepage text absent');
assert.ok(enHome.includes('href="/about/"') || enHome.includes('href="/about"'), 'English About link absent');

const esSearch = html('/es/search/');
assert.ok(esSearch.includes('Buscar artículos'), 'Spanish search missing');
assert.ok(!esSearch.includes('hreflang="es"'), 'Noindex search must not claim translation alternate');

const esTopic = html('/es/topics/mcp/');
assert.ok(esTopic.includes('lang="es"'), 'Wrong Spanish topic language');
assert.ok(esTopic.includes('href="/es/mcp/"'), 'Spanish topic links must point to Spanish articles');

const enRss = readFileSync(join(dist, 'rss.xml'), 'utf8');
const esRss = readFileSync(join(dist, 'es/rss.xml'), 'utf8');
assert.ok(enRss.includes('/mcp/'), 'English RSS missing article');
assert.ok(esRss.includes('/es/mcp/'), 'Spanish RSS missing translated article');
assert.ok(!enRss.includes('/es/mcp/'), 'English RSS must not contain Spanish duplicate');
assert.ok(!esRss.includes('https://luisiitodev.com/mcp/'), 'Spanish RSS must use Spanish URLs');

console.log('Bilingual output verified: 10 article pairs, home, About, search, topics, reciprocal SEO tags and both RSS feeds.');
