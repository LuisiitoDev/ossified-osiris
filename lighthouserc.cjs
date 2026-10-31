// Lighthouse CI runs against Netlify Deploy Preview, not local Astro dist:
// NETLIFY=true uses /.netlify/images, which works only through Netlify.
const pr = process.env.LHCI_PR_NUMBER;
if (!/^[1-9]\d*$/.test(pr ?? '')) {
  throw new Error('Set LHCI_PR_NUMBER to a valid pull-request number');
}
const baseUrl = `https://deploy-preview-${pr}--luiistodev.netlify.app`;

module.exports = {
  ci: {
    collect: {
      url: [
        `${baseUrl}/`,            // home / article discovery
        `${baseUrl}/about`,       // profile / certification badges
        `${baseUrl}/mcp`,         // technical article with code and imagery
      ],
      numberOfRuns: 2,
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
      },
    },
    assert: {
      assertions: {
        // Initial baseline: report regressions without making merges flaky.
        // Real thresholds can become errors after a measured baseline.
        'categories:performance': ['warn', { minScore: 0.70 }],
        'categories:accessibility': ['warn', { minScore: 0.85 }],
        'categories:best-practices': ['warn', { minScore: 0.80 }],
        'categories:seo': ['warn', { minScore: 0.80 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lighthouse-reports',
    },
  },
};
