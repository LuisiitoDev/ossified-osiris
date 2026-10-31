import test from 'node:test';
import assert from 'node:assert/strict';
import rehypeLazyImages from '../src/plugins/rehypeLazyImages.mjs';

test('adds lazy loading to images within Markdown content', () => {
  const root = {
    type: 'root',
    children: [{ type: 'element', tagName: 'p', children: [
      { type: 'element', tagName: 'img', properties: { src: '/screenshot.png', alt: 'Screenshot' }, children: [] },
    ] }],
  };
  rehypeLazyImages()(root);
  const image = root.children[0].children[0];
  assert.equal(image.properties.loading, 'lazy');
  assert.equal(image.properties.decoding, 'async');
  assert.equal(image.properties.src, '/screenshot.png');
  assert.equal(image.properties.alt, 'Screenshot');
});

test('preserves explicit eager loading and decoding', () => {
  const image = { type: 'element', tagName: 'img', properties: {
    loading: 'eager', decoding: 'sync', src: '/important.png',
  }, children: [] };
  rehypeLazyImages()(image);
  assert.equal(image.properties.loading, 'eager');
  assert.equal(image.properties.decoding, 'sync');
});

test('leaves non-image elements unchanged', () => {
  const root = { type: 'root', children: [
    { type: 'element', tagName: 'a', properties: { href: '/about' }, children: [] },
  ] };
  rehypeLazyImages()(root);
  assert.deepEqual(root.children[0].properties, { href: '/about' });
});

test('rewrites local Markdown raster images to responsive CDN variants when enabled', () => {
  const image = { type: 'element', tagName: 'img', properties: {
    src: '/img/mcp/mcp-diagram.png', alt: 'MCP diagram',
  }, children: [] };
  rehypeLazyImages({ enabled: true })(image);
  assert.match(image.properties.src, /^\/.netlify\/images\?url=/);
  assert.equal(image.properties.srcSet.split(', ').length, 4);
  assert.equal(image.properties.loading, 'lazy');
  assert.equal(image.properties.alt, 'MCP diagram');
});

test('preserves an author-specified responsive srcset', () => {
  const image = { type: 'element', tagName: 'img', properties: {
    src: '/img/example.png', srcSet: '/img/example-small.png 480w',
  }, children: [] };
  rehypeLazyImages({ enabled: true })(image);
  assert.equal(image.properties.src, '/img/example.png');
  assert.equal(image.properties.srcSet, '/img/example-small.png 480w');
});
