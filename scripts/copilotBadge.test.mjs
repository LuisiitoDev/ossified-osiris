import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const about = readFileSync(new URL('../src/pages/about.astro', import.meta.url), 'utf8');
const badge = readFileSync(new URL('../public/copilot-pro-proficient.webp', import.meta.url));

test('uses the exact locally hosted GitHub Copilot badge asset, rather than an external image', () => {
  assert.equal(badge.toString('ascii', 0, 4), 'RIFF');
  assert.equal(badge.toString('ascii', 8, 12), 'WEBP');
  assert.ok(badge.length > 1000 && badge.length < 15000);
  assert.ok(about.includes('src="/copilot-pro-proficient.webp"'));
});

test('profile photo remains circular while the badge can extend outside its crop', () => {
  const region = about.slice(
    about.indexOf('<!-- Profile photo with a compact, keyboard-accessible achievement badge. -->'),
    about.indexOf('<!-- Interactive Profile Share Card Modal -->'),
  );
  assert.match(region, /class="relative z-20 h-36 w-36 sm:h-40 sm:w-40"/);
  assert.match(region, /overflow-hidden rounded-full/);
  assert.match(region, /absolute -bottom-3 -right-4/);
  assert.match(region, /data-copilot-badge/);
});

test('details card has native keyboard activation and an accessible name', () => {
  assert.match(about, /<details[^>]+data-copilot-badge>/);
  assert.match(about, /<summary[\s\S]*?aria-label="GitHub Copilot Pro Badge, Proficient/);
  assert.match(about, /role="region" aria-label="GitHub Copilot Proficient badge details"/);
  assert.match(about, /event\.key !== 'Escape'/);
  assert.match(about, /card\.querySelector\('summary'\)\?\.focus\(\)/);
});

test('achievement is not presented as an Expert certificate or verification link', () => {
  assert.match(about, /Skill recognition · Separate from Microsoft certifications/);
  assert.match(about, /Certifications & Credentials/);
  assert.doesNotMatch(about, /Microsoft Applied Skills|Resolve GitHub issues by using GitHub Copilot/);
});
