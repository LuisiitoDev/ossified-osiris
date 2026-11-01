import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { expectedPreviewUrl, previewStatus, waitForNetlify, NETLIFY_CONTEXT } from './waitForNetlifyPreview.mjs';
import { makeSummary, scoreText } from './summarizeLighthouse.mjs';

const require = createRequire(import.meta.url);
const sha = 'f'.repeat(40);
const pr = 23;
const base = expectedPreviewUrl(pr);
const success = { context: NETLIFY_CONTEXT, state: 'success', target_url: base };
const pending = { context: NETLIFY_CONTEXT, state: 'pending', target_url: base };

test('preview URL is restricted to our Netlify site and valid positive PR number', () => {
  assert.equal(expectedPreviewUrl(pr), 'https://deploy-preview-23--luiistodev.netlify.app');
  assert.throws(() => expectedPreviewUrl('../23'), /Invalid PR/);
  assert.throws(() => expectedPreviewUrl('0'), /Invalid PR/);
});

test('require latest matching Netlify success for the PR commit, not any green status', () => {
  assert.equal(previewStatus([{ context: 'build', state: 'success' }], pr), 'pending');
  assert.equal(previewStatus([pending], pr), 'pending');
  assert.equal(previewStatus([success], pr), 'success');
  assert.throws(() => previewStatus([{ ...success, state: 'failure' }], pr), /failed/);
  assert.throws(() => previewStatus([{ ...success, target_url: 'https://evil.example/' }], pr), /unexpected/);
  assert.throws(() => previewStatus([{ ...success, target_url: expectedPreviewUrl(22) }], pr), /unexpected/);
});

test('waitForNetlify checks exact commit status then the deployed HTML', async () => {
  const calls = [];
  let statusChecks = 0;
  let slept = 0;
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('api.github.com')) {
      statusChecks += 1;
      return Response.json({ statuses: statusChecks === 1 ? [pending] : [success] });
    }
    return new Response('<html><title>About Me</title></html>', { status: 200 });
  };
  const url = await waitForNetlify({
    repo: 'LuisiitoDev/ossified-osiris', sha, pr, token: 'test-token',
    fetchImpl, sleep: async () => { slept++; }, now: () => 0,
  });
  assert.equal(url, base);
  assert.equal(statusChecks, 2);
  assert.equal(slept, 1);
  assert.equal(calls[0].url, `https://api.github.com/repos/LuisiitoDev/ossified-osiris/commits/${sha}/status`);
  assert.equal(calls.at(-1).url, base + '/about');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
});

test('invalid release or GitHub status is not silently audited', async () => {
  const fetchImpl = async () => Response.json({ statuses: [{ ...success, state: 'error' }] });
  await assert.rejects(waitForNetlify({
    repo: 'LuisiitoDev/ossified-osiris', sha, pr, token: 'test',
    fetchImpl,
  }), /failed/);
  await assert.rejects(waitForNetlify({
    repo: 'LuisiitoDev/ossified-osiris', sha: 'not-sha', pr, token: 'test',
  }), /Invalid PR head SHA/);
});

const report = (path, data) => ({
  url: base + path,
  isRepresentativeRun: true,
  summary: {
    performance: data[0],
    accessibility: data[1],
    'best-practices': data[2],
    seo: data[3],
  },
});

test('config selects three production-like paths with warning-only thresholds', () => {
  process.env.LHCI_PR_NUMBER = String(pr);
  const conf = require('../lighthouserc.cjs').ci;
  assert.deepEqual(conf.collect.url, [base + '/', base + '/about', base + '/mcp']);
  assert.equal(conf.collect.numberOfRuns, 2);
  assert.equal(conf.upload.target, 'filesystem');
  assert.equal(conf.upload.outputDir, './lighthouse-reports');
  for (const value of Object.values(conf.assert.assertions)) assert.equal(value[0], 'warn');
  const workflow = readFileSync(new URL('../.github/workflows/lighthouse-ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /PR_HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});

test('summarizes representative run scores for all three pages', () => {
  const entries = [
    report('/', [0.765, 0.9, 1, 0.8]),
    { ...report('/', [0.2, 0.3, 0.4, 0.5]), isRepresentativeRun: false },
    report('/about', [0.8, 0.99, 0.95, 0.9]),
    report('/mcp', [0.69, 0.91, 0.9, 1]),
  ];
  const summary = makeSummary(entries, pr);
  assert.match(summary, /\| \/ \| 77 \| 90 \| 100 \| 80 \|/);
  assert.match(summary, /\| \/about \| 80 \| 99 \| 95 \| 90 \|/);
  assert.match(summary, /\| \/mcp \| 69 \| 91 \| 90 \| 100 \|/);
  assert.match(summary, /warnings.*not merge gates/);
});

test('fails missing page results and formats null scores without inventing data', () => {
  assert.equal(scoreText(null), 'N/A');
  assert.throws(() => makeSummary([report('/', [1, 1, 1, 1])], pr), /all three planned pages/);
});
