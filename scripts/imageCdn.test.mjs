import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalRasterImage, responsiveImageAttributes } from '../src/utils/imageCdn.mjs';

test('optimizes local PNG/JPEG on Netlify and returns multiple responsive widths', () => {
  const result = responsiveImageAttributes('/img/mcp/rick.png', {
    enabled: true,
    widths: [1440, 640, 960, 640],
    sizes: '(max-width: 700px) 100vw, 800px',
  });
  assert.equal(result.src, '/.netlify/images?url=%2Fimg%2Fmcp%2Frick.png&w=1440&q=75');
  assert.equal(result.sizes, '(max-width: 700px) 100vw, 800px');
  assert.equal(result.srcset.split(', ').length, 3);
  assert.match(result.srcset, /&w=640&q=75 640w/);
});

test('never rewrites assets for non-Netlify builds', () => {
  assert.deepEqual(responsiveImageAttributes('/img/mcp/rick.png', { enabled: false }), { src: '/img/mcp/rick.png' });
});

test('preserves SVG, remote URLs and non-raster files', () => {
  for (const src of ['/img/diagram.svg', 'https://example.org/photo.png', '//example.com/photo.jpg', '/fonts/font.woff', 'data:image/png;base64,AAAA']) {
    assert.equal(isLocalRasterImage(src), false);
    assert.deepEqual(responsiveImageAttributes(src, { enabled: true }), { src });
  }
});

test('guards invalid width or quality settings', () => {
  assert.deepEqual(responsiveImageAttributes('/img/test.jpg', { enabled: true, widths: [0, -10] }), { src: '/img/test.jpg' });
  const result = responsiveImageAttributes('/img/test.jpg', { enabled: true, widths: [640], quality: 500 });
  assert.match(result.src, /&q=75$/);
});
