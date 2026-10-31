import test from 'node:test';
import assert from 'node:assert/strict';
import { getTocHeadings, showTableOfContents } from '../src/utils/tableOfContents.mjs';

test('only actual H2/H3 headings are included in document order', () => {
  const headings = [
    { depth: 1, text: 'Post', slug: 'post' },
    { depth: 2, text: 'Introduction', slug: 'introduction' },
    { depth: 3, text: 'Install', slug: 'install' },
    { depth: 4, text: 'Unimportant', slug: 'unimportant' },
    { depth: 2, text: 'Conclusion', slug: 'conclusion' },
  ];
  assert.deepEqual(getTocHeadings(headings).map(h => h.slug), ['introduction', 'install', 'conclusion']);
  assert.equal(showTableOfContents(headings), true);
});

test('omits TOC for short posts and invalid slugs', () => {
  assert.equal(showTableOfContents([{ depth: 2, text: 'A', slug: 'a' }]), false);
  assert.equal(showTableOfContents([{ depth: 2, text: 'A', slug: 'a' }, { depth: 2, text: 'B', slug: 'b' }]), false);
  assert.deepEqual(getTocHeadings([{ depth: 2, text: 'No slug', slug: '' }, { depth: 2, text: ' ', slug: 'empty-text' }]), []);
});

test('missing headings do not break the page', () => {
  assert.deepEqual(getTocHeadings(), []);
  assert.equal(showTableOfContents(), false);
});
