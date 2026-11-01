import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const head = readFileSync(new URL('../src/components/BaseHead.astro', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

const googleFontUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap';

test('Google Fonts preserves both families and existing selected weights', () => {
  assert.equal(head.split(googleFontUrl).length - 1, 2, 'expected runtime link plus noscript fallback');
  assert.match(css, /--font-title:\s*'Outfit',\s*sans-serif/);
  assert.match(css, /--font-body:\s*'Inter',\s*sans-serif/);
});

test('main font stylesheet starts with nonmatching media and activates after loading', () => {
  assert.match(head, /rel="stylesheet"\s+media="print"\s+onload="this\.onload=null;this\.media='all'"/);
  assert.doesNotMatch(head, /rel="preload"\s+as="style"/);
  assert.match(head, /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/);
});

test('no-JavaScript fallback retains the same font stylesheet', () => {
  assert.match(head, /<noscript>\s*<link\s+href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:[^"]+"\s+rel="stylesheet"\s*>\s*<\/noscript>/);
});

test('font optimization is limited to the head and does not affect analytics or critical dark mode setup', () => {
  assert.match(head, /Google tag \(gtag\.js\)/);
  assert.match(head, /Dark Mode Initialization/);
  assert.match(head, /<script is:inline>/);
});
