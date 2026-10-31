import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const about = readFileSync(new URL('../src/pages/about.astro', import.meta.url), 'utf8');
const badge = readFileSync(new URL('../public/copilot-pro-proficient.webp', import.meta.url));
const profileSection = about.slice(
  about.indexOf('<!-- Profile image with a small Copilot proficiency badge;'),
  about.indexOf('<!-- Interactive Profile Share Card Modal -->'),
);

test('uses the original locally hosted lightweight GitHub Copilot badge', () => {
  assert.equal(badge.toString('ascii', 0, 4), 'RIFF');
  assert.equal(badge.toString('ascii', 8, 12), 'WEBP');
  assert.ok(badge.length > 1000 && badge.length < 15000);
  assert.equal((profileSection.match(/src="\/copilot-pro-proficient\.webp"/g) || []).length, 1);
});

test('badge is a small decorative accent outside the circular photo crop', () => {
  assert.match(profileSection, /class="relative h-36 w-36 sm:h-40 sm:w-40"/);
  assert.match(profileSection, /overflow-hidden rounded-full/);
  assert.match(profileSection, /absolute -bottom-1 -right-1 h-11 w-11/);
  assert.match(profileSection, /width="48"\s+height="48"/);
  assert.match(profileSection, /alt=""\s+aria-hidden="true"/);
  assert.doesNotMatch(profileSection, /rounded-2xl border border-violet-400\/35 bg-slate-950/);
});

test('accessible chip explains the proficiency badge in normal reading order', () => {
  assert.match(profileSection, /<p class="[^"]*rounded-full[^"]*"/);
  assert.match(profileSection, />GitHub Copilot<\/span>/);
  assert.match(profileSection, />Proficient<\/span>/);
  assert.ok(profileSection.indexOf('/copilot-pro-proficient.webp') < profileSection.indexOf('>GitHub Copilot</span>'));
});

test('simple profile has no popover or interactive trigger to obscure the photo', () => {
  assert.doesNotMatch(profileSection, /<details|<summary|<script|role="region"|data-copilot-badge|pointerdown/);
  assert.match(about, /<!-- Interactive Profile Share Card Modal -->/);
  assert.match(about, /Certifications & Credentials/);
  assert.doesNotMatch(about, /Microsoft Applied Skills|Resolve GitHub issues by using GitHub Copilot/);
});
