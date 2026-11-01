import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export const NETLIFY_CONTEXT = 'netlify/luiistodev/deploy-preview';
export const MAX_WAIT_MS = 240_000;
export const POLL_INTERVAL_MS = 8_000;

export function expectedPreviewUrl(prNumber) {
  if (!/^[1-9]\d*$/.test(String(prNumber))) {
    throw new Error('Invalid PR number');
  }
  return `https://deploy-preview-${prNumber}--luiistodev.netlify.app`;
}

export function previewStatus(statuses, prNumber) {
  if (!Array.isArray(statuses)) throw new Error('Invalid GitHub commit status response');
  const status = statuses.find((s) => s.context === NETLIFY_CONTEXT);
  if (!status) return 'pending';
  if (status.state === 'failure' || status.state === 'error') {
    throw new Error('Netlify Deploy Preview failed for the requested PR commit');
  }
  if (status.state !== 'success') return 'pending';

  const expected = expectedPreviewUrl(prNumber);
  if (typeof status.target_url !== 'string') {
    throw new Error('Netlify reported success without a Deploy Preview URL');
  }
  const target = new URL(status.target_url);
  if (target.protocol !== 'https:' || target.hostname !== new URL(expected).hostname) {
    throw new Error('Netlify returned an unexpected Deploy Preview host');
  }
  return 'success';
}

export async function waitForNetlify({
  repo, sha, pr, token, fetchImpl = fetch,
  sleep = delay, maxWaitMs = MAX_WAIT_MS, now = Date.now,
}) {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Invalid PR head SHA');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Invalid repository');
  if (typeof token !== 'string' || token.length === 0) throw new Error('Missing GitHub token');
  const preview = expectedPreviewUrl(pr);
  const deadline = now() + maxWaitMs;

  while (now() < deadline) {
    const response = await fetchImpl(
      `https://api.github.com/repos/${repo}/commits/${sha}/status`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'luisiitodev-lighthouse-ci',
        },
      },
    );
    if (!response.ok) throw new Error(`GitHub commit status API returned ${response.status}`);
    const data = await response.json();
    if (previewStatus(data.statuses, pr) === 'success') {
      const page = await fetchImpl(`${preview}/about`, {
        headers: { 'User-Agent': 'luisiitodev-lighthouse-ci' },
      });
      if (!page.ok) throw new Error(`Netlify preview returned HTTP ${page.status}`);
      const html = await page.text();
      if (!html.includes('About Me')) {
        throw new Error('Netlify preview HTML is missing the About heading');
      }
      return preview;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Netlify Deploy Preview did not finish before the audit timeout');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { GITHUB_REPOSITORY: repo, PR_HEAD_SHA: sha, LHCI_PR_NUMBER: pr, GITHUB_TOKEN: token } = process.env;
  waitForNetlify({ repo, sha, pr, token })
    .then((url) => console.log('Verified Netlify Deploy Preview for PR head commit: ' + url))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
