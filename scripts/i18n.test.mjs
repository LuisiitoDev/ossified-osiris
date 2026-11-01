import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { articleRoute, alternateLocaleRoute, localeFromPath, localeRoute, localizedAlternates, translatedArticleSlugs } from '../src/utils/i18n.mjs';
import { spanishListing, spanishPostSummaries } from '../src/utils/spanishContent.mjs';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

test('English is the URL default and Spanish uses /es/ without breaking article slugs', () => {
  assert.equal(localeFromPath('/'), 'en');
  assert.equal(localeFromPath('/about/'), 'en');
  assert.equal(localeFromPath('/es/'), 'es');
  assert.equal(localeFromPath('/es/about/'), 'es');
  assert.equal(localeRoute('/', 'en'), '/');
  assert.equal(localeRoute('/', 'es'), '/es/');
  assert.equal(localeRoute('/about', 'en'), '/about/');
  assert.equal(localeRoute('/about', 'es'), '/es/about/');
});

test('navigation switches to equivalent pages only where true localization exists', () => {
  assert.equal(alternateLocaleRoute('/about/'), '/es/about/');
  assert.equal(alternateLocaleRoute('/es/about/'), '/about/');
  assert.equal(alternateLocaleRoute('/topics/azure/'), '/es/topics/azure/');
  assert.equal(alternateLocaleRoute('/es/topics/azure/'), '/topics/azure/');
  assert.equal(alternateLocaleRoute('/howigotmygithubactionscert/'), '/es/howigotmygithubactionscert/');
  assert.equal(alternateLocaleRoute('/mcp/'), '/es/'); // no dishonest article translation
  assert.equal(articleRoute('mcp', 'es'), '/mcp/');
});

test('hreflang remains reciprocal and is never published for untranslated posts', () => {
  assert.deepEqual(localizedAlternates('/'), { en: '/', es: '/es/' });
  assert.deepEqual(localizedAlternates('/es/about/'), { en: '/about/', es: '/es/about/' });
  assert.deepEqual(localizedAlternates('/howigotmygithubactionscert/'), {
    en: '/howigotmygithubactionscert/', es: '/es/howigotmygithubactionscert/',
  });
  assert.equal(localizedAlternates('/mcp/'), null);
  assert.equal(localizedAlternates('/es/search/'), null);
  assert.equal(translatedArticleSlugs.size, 4);
  assert.match(read('../src/components/BaseHead.astro'), /hreflang="x-default"/);
});

test('Spanish listing summaries clearly distinguish originals without body translations', () => {
  assert.equal(spanishListing({id:'mcp', data:{title:'MCP',description:'English text'}}).hasSpanishArticle, false);
  assert.equal(spanishListing({id:'howigotmygithubactionscert', data:{}}).hasSpanishArticle, true);
  assert.ok(Object.keys(spanishPostSummaries).length >= 10);
  assert.match(read('../src/pages/es/index.astro'), /en inglés/);
  assert.match(read('../src/pages/es/search.astro'), /en inglés/);
});

test('Spanish site pages, translated article and locale-aware navigation exist', () => {
  for (const file of ['../src/pages/es/index.astro','../src/pages/es/about.astro',
                      '../src/pages/es/search.astro','../src/pages/es/topics/[topic].astro',
                      '../src/pages/es/[...slug].astro']) {
    assert.ok(read(file).length > 400, 'missing ' + file);
  }
  assert.match(read('../src/content/blog/es/HowIGotMyGitHubActionsCert.md'), /lang: 'es'/);
  assert.match(read('../src/content/blog/es/HowIGotMyGitHubActionsCert.md'), /Mi objetivo profesional/);
  assert.match(read('../src/pages/[...slug].astro'), /!post\.id\.startsWith\('es\/'\)/);
  assert.match(read('../src/pages/rss.xml.js'), /!post\.id\.startsWith\('es\/'\)/);
});
