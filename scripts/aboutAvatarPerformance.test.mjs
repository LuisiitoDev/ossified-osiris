import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { imageCdnUrl, responsiveImageAttributes } from '../src/utils/imageCdn.mjs';

const about = readFileSync(new URL('../src/pages/about.astro', import.meta.url), 'utf8');
const share = readFileSync(new URL('../src/components/ProfileShareCard.astro', import.meta.url), 'utf8');
const imageHelper = readFileSync(new URL('../src/utils/imageCdn.mjs', import.meta.url), 'utf8');

test('About portrait uses responsive Netlify Image CDN, retaining original PNG for local dev', () => {
  assert.match(about, /responsiveImageAttributes\('\/luis-sandoval\.png', \{/);
  assert.match(about, /widths: \[160, 320\]/);
  assert.match(about, /\{\.\.\.avatarImage\}/);
  assert.doesNotMatch(about, /src="\/luis-sandoval\.png"/);
  assert.match(about, /object-fit: cover;/);
});

test('share preview and rendered canvas use distinct suitable-sized same-origin variants', () => {
  assert.match(share, /responsiveImageAttributes\('\/luis-sandoval\.png', \{/);
  assert.match(share, /widths: \[96, 192\]/);
  assert.match(share, /imageCdnUrl\('\/luis-sandoval\.png', \{ width: 480 \}\)/);
  assert.match(share, /data-avatar-canvas-src=\{shareCanvasAvatar\}/);
  assert.match(share, /\{\.\.\.sharePreviewAvatar\}/);
  assert.match(share, /img\.src = preview\?\.dataset\.avatarCanvasSrc \|\| '\/luis-sandoval\.png'/);
  assert.doesNotMatch(share, /src="\/luis-sandoval\.png"/);
});

test('standalone canvas CDN URL is bounded, encoded and preserves local fallback', () => {
  assert.equal(imageCdnUrl('/luis-sandoval.png', { width: 480, enabled: true }),
    '/.netlify/images?url=%2Fluis-sandoval.png&w=480&q=75');
  assert.equal(imageCdnUrl('/luis-sandoval.png', { width: 480, enabled: false }), '/luis-sandoval.png');
  assert.equal(imageCdnUrl('/luis-sandoval.png', { width: -1, enabled: true }), '/luis-sandoval.png');
  assert.equal(imageCdnUrl('https://example.com/test.png', { width: 480, enabled: true }), 'https://example.com/test.png');
  assert.equal(imageCdnUrl('/luis-sandoval.png', { width: 480, quality: 0, enabled: true }),
    '/.netlify/images?url=%2Fluis-sandoval.png&w=480&q=75');
});

test('responsive image helper retains existing callers and uses new URL generator', () => {
  assert.match(imageHelper, /urlFor = \(width\) => imageCdnUrl/);
  assert.deepEqual(responsiveImageAttributes('/luis-sandoval.png', {
    widths: [160, 320],
    sizes: '160px',
    enabled: true,
  }), {
    src: '/.netlify/images?url=%2Fluis-sandoval.png&w=320&q=75',
    srcset: '/.netlify/images?url=%2Fluis-sandoval.png&w=160&q=75 160w, /.netlify/images?url=%2Fluis-sandoval.png&w=320&q=75 320w',
    sizes: '160px',
  });
});
