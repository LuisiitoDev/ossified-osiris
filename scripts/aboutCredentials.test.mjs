import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const about = readFileSync(new URL('../src/pages/about.astro', import.meta.url), 'utf8');
const target = 'https://learn.microsoft.com/es-mx/users/luissandoval-5751/credentials/certification/devops-engineer?tab=credentials-tab';

test('DevOps Engineer Expert card uses the personal verification link, not the generic overview', () => {
  assert.ok(about.includes('href="' + target + '"'));
  assert.doesNotMatch(about, /About this Microsoft certification/);
});

test('Expert card displays Microsoft Expert badge instead of Associate or text-only art', () => {
  const start = about.indexOf('<!-- Expert certification spotlight:');
  const end = about.indexOf('Key certifications</h3>', start);
  assert.ok(start >= 0 && end > start);
  const spotlight = about.slice(start, end);
  assert.match(spotlight, /microsoft-certified-expert-badge\.svg/);
  assert.match(spotlight, /alt="Microsoft Certified Expert badge"/);
  assert.doesNotMatch(spotlight, /microsoft-certified-associate\.png/);
  assert.match(spotlight, /Verify Credential/);
});

test('Applied Skills remain excluded from the About page', () => {
  assert.doesNotMatch(about, /Microsoft Applied Skills|Resolve GitHub issues by using GitHub Copilot/);
});
