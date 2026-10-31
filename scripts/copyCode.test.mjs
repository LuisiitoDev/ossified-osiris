import test from 'node:test';
import assert from 'node:assert/strict';
import { getCodeText } from '../src/utils/copyCode.mjs';

test('returns the exact code content rather than outer pre or wrapper text', () => {
  const pre = {
    textContent: 'Copyconsole.log("hi");',
    querySelector(selector) {
      assert.equal(selector, 'code');
      return { textContent: '  console.log("hi");\n' };
    },
  };
  assert.equal(getCodeText(pre), '  console.log("hi");\n');
});

test('falls back for raw pre tags without code element', () => {
  assert.equal(getCodeText({
    textContent: 'SELECT *\nFROM Customers;',
    querySelector: () => null,
  }), 'SELECT *\nFROM Customers;');
});

test('handles empty or missing code without throwing', () => {
  assert.equal(getCodeText(null), '');
  assert.equal(getCodeText({ textContent: '', querySelector: () => null }), '');
});
