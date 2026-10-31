import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const CATEGORIES = [
  ['performance', 'Performance'],
  ['accessibility', 'Accessibility'],
  ['best-practices', 'Best practices'],
  ['seo', 'SEO'],
];

export function scoreText(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(Math.round(value * 100))
    : 'N/A';
}

export function makeSummary(entries, pr) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('Lighthouse report manifest is missing results');
  }
  const representative = entries.filter((item) => item.isRepresentativeRun);
  if (representative.length === 0) {
    throw new Error('No representative Lighthouse runs found');
  }
  const expectedRoutes = ['/', '/about', '/mcp'];
  const rows = representative.map((entry) => {
    const url = new URL(entry.url);
    const pathname = url.pathname.replace(/\/$/, '') || '/';
    if (!expectedRoutes.includes(pathname)) {
      throw new Error('Unexpected Lighthouse audited route: ' + pathname);
    }
    const scores = CATEGORIES.map(([key]) => scoreText(entry.summary?.[key]));
    return `| ${pathname} | ${scores.join(' | ')} |`;
  });
  if (rows.length !== expectedRoutes.length ||
      !expectedRoutes.every((p) => representative.some((r) => {
        const u = new URL(r.url);
        return (u.pathname.replace(/\/$/, '') || '/') === p;
      }))) {
    throw new Error('Lighthouse results did not cover all three planned pages');
  }
  return [
    '## Lighthouse CI — PR #' + pr,
    '',
    'Mobile lab scores, using representative run from two measurements per URL.',
    'Measured **Netlify Deploy Preview** (including Image CDN), not local Astro.',
    '',
    '| Page | Performance | Accessibility | Best practices | SEO |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    'Scores are on a 0–100 scale. Initial thresholds are **warnings**, not merge gates.',
    'Download the `lighthouse-reports` artifact in this workflow run for full HTML and JSON audits.',
    'Synthetic scores vary by environment and are not real-user Core Web Vitals.',
    '',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const manifest = JSON.parse(readFileSync('lighthouse-reports/manifest.json', 'utf8'));
    const markdown = makeSummary(manifest, process.env.LHCI_PR_NUMBER || 'unknown');
    console.log(markdown);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
    }
  } catch (error) {
    console.error('Unable to summarize Lighthouse reports:', error.message);
    process.exitCode = 1;
  }
}
