import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const header = readFileSync(new URL('../src/components/Header.astro', import.meta.url), 'utf8');
const headerLink = readFileSync(new URL('../src/components/HeaderLink.astro', import.meta.url), 'utf8');

test('mobile header keeps logo, language and theme buttons with a compact menu', () => {
  assert.match(header, /class="mobile-menu relative sm:hidden"/);
  assert.match(header, /<summary[\s\S]*?aria-label=\{locale === 'es' \? 'Abrir menú de navegación' : 'Open navigation menu'\}/);
  assert.match(header, /internal-links hidden items-center gap-1 sm:flex/);
  assert.match(header, /hidden h-5 w-\[1px\]/);
  assert.match(header, /\{locale === 'en' \? 'ES' : 'EN'\}/);
  assert.match(header, /id="theme-toggle"/);
  assert.match(header, /font-size: 1\.15rem/);
});

test('mobile dropdown reuses localized routes and real link active styles', () => {
  const menu = header.slice(header.indexOf('<details class="mobile-menu'), header.indexOf('</details>'));
  assert.match(menu, /<HeaderLink href=\{localeRoute\("\/", locale\)\}>\{t.home\}<\/HeaderLink>/);
  assert.match(menu, /<HeaderLink href=\{localeRoute\("\/about", locale\)\}>\{t.about\}<\/HeaderLink>/);
  assert.match(menu, /aria-label=\{t.navigation\}/);
  assert.match(headerLink, /normalized\(String\(href\)\) === normalized\(pathname\)/);
});

test('mobile navigation is keyboard accessible and dismissible', () => {
  assert.match(header, /focus-visible:outline-2/);
  assert.match(header, /'Escape'/);
  assert.match(header, /menu\.open = false/);
  assert.match(header, /menu\.querySelector\('summary'\)\?\.focus\(\)/);
  assert.match(header, /document\.addEventListener\('pointerdown', dismissMobileMenu\)/);
});
