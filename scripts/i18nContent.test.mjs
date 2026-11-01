import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { translatedArticleSlugs } from '../src/utils/i18n.mjs';

const base = fileURLToPath(new URL('../src/content/blog/', import.meta.url));
const spanishDir = join(base, 'es');
const originals = readdirSync(base).filter((name) => /\.mdx?$/.test(name)).sort();
const spanish = readdirSync(spanishDir).filter((name) => /\.mdx?$/.test(name)).sort();

const text = (path) => readFileSync(path, 'utf8');
const fenced = (body) => [...body.matchAll(/```[\s\S]*?```/g)].map((m) => m[0]);
const images = (body) => [
  ...[...body.matchAll(/!\[[^\]]*\]\((\/[\w./-]+)/g)].map((m) => m[1]),
  ...[...body.matchAll(/<img\s+src="([^"]+)"/g)].map((m) => m[1]),
].sort();
const frontmatterValue = (body, field) =>
  body.match(new RegExp('^' + field + ':\\s*[^\\n]+', 'm'))?.[0].split(':').slice(1).join(':').trim();

test('every published article has a real complete Spanish Markdown version', () => {
  assert.equal(originals.length, 10, 'Update the translation list when adding a post');
  assert.deepEqual(spanish, originals);
  assert.equal(translatedArticleSlugs.size, originals.length);
  for (const filename of originals) {
    const slug = filename.replace(/\.mdx?$/, '').toLowerCase();
    assert.ok(translatedArticleSlugs.has(slug), 'Missing registered translation: ' + slug);
    assert.match(text(join(spanishDir, filename)), /^lang: 'es'$/m);
    assert.match(text(join(base, filename)), /^lang: 'en'$|^---/m);
  }
});

test('translated articles retain every code example and embedded image', () => {
  for (const filename of originals) {
    const en = text(join(base, filename));
    const es = text(join(spanishDir, filename));
    assert.deepEqual(fenced(es), fenced(en), 'Code altered during translation: ' + filename);
    assert.deepEqual(images(es), images(en), 'Image paths altered during translation: ' + filename);
  }
});

test('all translated articles keep the original publication date and topic tags', () => {
  for (const filename of originals) {
    const en = text(join(base, filename));
    const es = text(join(spanishDir, filename));
    const enDate = frontmatterValue(en, 'pubDate')?.replace(/^['"]|['"]$/g, '');
    const esDate = frontmatterValue(es, 'pubDate')?.replace(/^['"]|['"]$/g, '');
    assert.equal(new Date(esDate).toISOString().slice(0, 10),
      new Date(enDate).toISOString().slice(0, 10), 'Publication date differs: ' + filename);
    assert.equal(frontmatterValue(es, 'tags'), frontmatterValue(en, 'tags'), 'Tags differ: ' + filename);
  }
});
