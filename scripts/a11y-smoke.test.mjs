import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditBuiltSite, checkAccessibleHtml } from './a11y-smoke.mjs';

const valid = '<!doctype html><html lang="en"><head><title>Blog</title></head>' +
  '<body><a href="#main-content">Skip to main content</a>' +
  '<header><nav aria-label="Main navigation">Navigation</nav></header>' +
  '<main id="main-content" tabindex="-1">' +
  '<img src="/hero.jpg" alt="Architecture diagram">' +
  '<img src="/dots.svg" alt="">' +
  '<label for="query">Search</label><input id="query" type="search">' +
  '</main></body></html>';

test('accepts accessible landmarks, input labels and decorative image alt', () => {
  assert.deepEqual(checkAccessibleHtml(valid), []);
});

test('requires a real page title and declared HTML language', () => {
  const broken = valid.replace(' lang="en"', '').replace('<title>Blog</title>', '<title> </title>');
  assert.ok(checkAccessibleHtml(broken).some((s) => s.includes('language')));
  assert.ok(checkAccessibleHtml(broken).some((s) => s.includes('nonempty title')));
});

test('checks exactly one main, a correctly targeted skip link and source order', () => {
  assert.ok(checkAccessibleHtml(valid.replace('id="main-content"', 'id="content"'))
    .some((s) => s.includes('id="main-content"')));
  assert.ok(checkAccessibleHtml(valid.replace('<main id=', '<main></main><main id='))
    .some((s) => s.includes('exactly one')));
  assert.ok(checkAccessibleHtml(valid.replace('<a href="#main-content">Skip to main content</a>', ''))
    .some((s) => s.includes('skip link')));
});

test('detects images without alt and fields without labels', () => {
  const broken = valid.replace('alt="Architecture diagram"', '')
    .replace('<label for="query">Search</label>', '');
  assert.ok(checkAccessibleHtml(broken).some((s) => s.includes('no alt')));
  assert.ok(checkAccessibleHtml(broken).some((s) => s.includes('needs a visible')));
});

test('accepts aria-label input and ignores content in script and style blocks', () => {
  const page = valid.replace('<label for="query">Search</label><input id="query" type="search">',
    '<input aria-label="Search articles" type="search">')
    .replace('</head>', '<script>const fake = "<img src=x>";</script>' +
      '<style>.fake::before{content:"<img src=x>";}</style></head>');
  assert.deepEqual(checkAccessibleHtml(page), []);
});

test('checks each generated page and reports its path', () => {
  const root = mkdtempSync(join(tmpdir(), 'blog-a11y-'));
  try {
    mkdirSync(join(root, 'article'), { recursive: true });
    writeFileSync(join(root, 'index.html'), valid);
    writeFileSync(join(root, 'article', 'index.html'), valid.replace('alt="Architecture diagram"', ''));
    const result = auditBuiltSite(root);
    assert.equal(result.pages, 2);
    assert.match(result.errors[0], /article\/index\.html/);
  } finally { rmSync(root, { force: true, recursive: true }); }
});
