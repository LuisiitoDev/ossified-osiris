import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateBuiltSite } from './validate-internal-links.mjs';

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'astro-blog-links-'));
  const add = (pathname, content) => {
    const file = join(root, pathname);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, content);
  };
  try { run({ root, add }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test('validates routes, anchors, local assets and CDN source assets', () => {
  fixture(({ root, add }) => {
    add('index.html', '<a href="/about">About</a>' +
      '<a href="/post/#install">Read</a>' +
      '<a href="https://other.site/missing">External</a>' +
      '<img src="/.netlify/images?url=%2Fimages%2Fhero.png&amp;w=640&amp;q=75"' +
      ' srcset="/.netlify/images?url=%2Fimages%2Fhero.png&amp;w=320 320w, ' +
      '/.netlify/images?url=%2Fimages%2Fhero.png&amp;w=640 640w">');
    add('about/index.html', '<h1 id="about">About</h1>');
    add('post/index.html', '<h2 id="install">Installation</h2>');
    add('images/hero.png', 'fake image fixture');
    const result = validateBuiltSite(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.files, 3);
  });
});

test('detects missing article routes and missing image sources', () => {
  fixture(({ root, add }) => {
    add('index.html', '<a href="/not-published/">Missing article</a>' +
      '<img src="/images/not-here.png">' +
      '<img src="/.netlify/images?url=%2Fimages%2Fother-missing.jpg&amp;w=480">');
    const result = validateBuiltSite(root);
    assert.equal(result.errors.length, 3);
    assert.ok(result.errors.some((e) => e.includes('/not-published/')));
    assert.ok(result.errors.some((e) => e.includes('/images/not-here.png')));
    assert.ok(result.errors.some((e) => e.includes('other-missing.jpg')));
  });
});

test('detects broken heading anchors', () => {
  fixture(({ root, add }) => {
    add('index.html', '<a href="/post/#non-existent">Bad anchor</a>');
    add('post/index.html', '<h2 id="real-section">Real section</h2>');
    assert.match(validateBuiltSite(root).errors.join(' '), /anchor not found/);
  });
});

test('ignores external links and Netlify Function runtime endpoints', () => {
  fixture(({ root, add }) => {
    add('index.html', '<a href="https://github.com/example/nopage">External</a>' +
      '<a href="mailto:hello@example.com">Email</a>' +
      '<a href="/api/counter/test">Counter</a>' +
      '<a href="https://luisiitodev.com/">Homepage</a>');
    assert.deepEqual(validateBuiltSite(root).errors, []);
  });
});

test('fails helpfully if dist output does not exist', () => {
  assert.match(validateBuiltSite('/does/not/exist').errors.join(' '), /not found/);
});
