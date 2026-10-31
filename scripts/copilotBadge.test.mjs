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

test('profile avatar overrides article image defaults so it fills the circular crop', () => {
  assert.match(profileSection, /class="about-avatar-image block h-full w-full select-none object-cover"/);
  const rules = about.match(/#article-content img\.about-avatar-image\s*\{([^}]+)\}/)?.[1];
  assert.ok(rules, 'Missing avatar-specific CSS override');
  for (const rule of [
    /width:\s*100%\s*;/,
    /height:\s*100%\s*;/,
    /margin:\s*0\s*;/,
    /object-fit:\s*cover\s*;/,
    /border:\s*0\s*;/,
  ]) assert.match(rules, rule);
});

test('floating Copilot badge has no prose margins and preserves compact dimensions', () => {
  assert.match(profileSection, /class="about-copilot-badge pointer-events-none absolute/);
  const rules = about.match(/#article-content img\.about-copilot-badge\s*\{([^}]+)\}/)?.[1];
  assert.ok(rules, 'Missing badge-specific CSS override');
  assert.match(rules, /margin:\s*0\s*;/);
  assert.match(rules, /width:\s*2\.75rem\s*;/);
  assert.match(rules, /height:\s*2\.75rem\s*;/);
  assert.match(about, /@media \(min-width: 640px\)\s*\{\s*#article-content img\.about-copilot-badge\s*\{\s*width:\s*3rem;\s*height:\s*3rem;/);
});
