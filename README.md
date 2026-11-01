[![Netlify Status](https://api.netlify.com/api/v1/badges/a5f5d99b-c67c-49e9-8457-76623d3082e3/deploy-status)](https://app.netlify.com/sites/luiistodev/deploys)

# LuisiitoDev — Software Engineering Blog

Source code for [luisiitodev.com](https://luisiitodev.com/), a technical blog about C#, .NET, Azure, DevOps, software architecture and AI engineering. This is a **blog**, not a portfolio template.

## Technology stack

- **Astro 5**, Markdown/MDX content collections and Tailwind CSS
- **Netlify** for static hosting, image delivery and a serverless page-view counter
- **GitHub Actions** for automated tests and build validation
- RSS, sitemap, article metadata (canonical, Open Graph and BlogPosting JSON-LD)
- Local article search and topic archive pages

## Local development

Use Node.js 22 and npm:

```bash
npm ci
npm run dev
```

Open `http://localhost:4321`. Validate the generated site with:

```bash
npm run build
npm run preview
```

`npm run build` generates static HTML in `dist/`. The CI workflow runs Node tests and performs a Netlify-mode Astro build.

## Publishing an article

Create a Markdown (`.md`) or MDX (`.mdx`) file in `src/content/blog/`. Example:

```yaml
---
title: 'Understanding Azure SQL deployments'
description: 'How to build and deploy DACPAC artifacts to Azure SQL using GitHub Actions, with practical lessons from a CI/CD pipeline.'
pubDate: '2026-10-31'
heroImage: '/img/azure-sql/hero.png'
tags: ['azure', 'devops', 'sql-server']
lang: 'en'
---
```

Editorial conventions:

1. **Title:** descriptive and specific to the article, while preserving existing published titles and slugs.
2. **Description:** a useful 40–180 character summary of what readers will learn. Avoid placeholders and unrelated keywords. It powers article cards, search and social preview metadata.
3. **Tags:** lowercase, hyphenated topic labels. Reuse existing tags when possible; the homepage topic selector, topic archives and related-article suggestions are derived from them.
4. **Language:** `lang: 'en'` is the default. Set `lang: 'es'` for a Spanish article; the HTML language, Open Graph locale and BlogPosting language metadata will adjust.
5. **Dates:** `pubDate` records original publication. Add `updatedDate` only after substantial edits; don't silently rewrite historical dates.
6. **Images:** put files under `public/`, and reference them by root-relative path. Supply informative alt text.

Article URLs follow `/<filename-without-extension>/`; changing an existing filename may change a published URL and break incoming links. Keep historical files stable unless a redirect is explicitly configured.

## SEO and article discovery

- `src/components/BaseHead.astro` owns canonical, social and structured metadata.
- `src/pages/rss.xml.js` generates the RSS feed at `/rss.xml`.
- `@astrojs/sitemap` generates `/sitemap-index.xml`; `public/robots.txt` references it.
- `/topics/<tag>/` lists articles by tag.
- `/search/` filters article titles, summaries and tags locally. Internal search pages are intentionally `noindex` and excluded from the sitemap.
- `src/components/RelatedPosts.astro` recommends related posts.

## Deploying to Netlify

The repository includes a Netlify deployment badge. The Astro build command is `npm run build`, with `dist` as the publish directory; confirm those values in your Netlify site settings.

Local PNG/JPEG/WebP images use responsive Netlify Image CDN URLs on builds with `NETLIFY=true`. Source files in `public/` are kept unchanged, including for canonical public URLs and social sharing. Regular `npm run dev` uses original assets. Review Netlify Deploy Preview for image correctness and inspect usage/billing when enabling transformations.

The visitor counter uses `netlify/functions/counter.js` and **persistent Upstash Redis** (recommended) with atomic increments. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` as Netlify environment variables, **never in the repository**. Without these two variables, the function continues using the existing CounterAPI v2 integration. See [Visitor counter configuration](#visitor-counter-configuration) below.

## Validation

GitHub Actions runs `.github/workflows/blog-ci.yml`, which checks the unit tests, Astro build, generated RSS and sitemap, search-page indexing behavior and the Spanish article language metadata.

CI checks do not substitute for mobile accessibility review, production performance measurements or Netlify Deploy Preview testing. Do not infer a Lighthouse score from the Astro starter template.

## Attribution

This blog was originally based on the [Astro Blog template](https://github.com/withastro/astro/tree/main/examples/blog), which credits [Bear Blog](https://github.com/HermanMartinus/bearblog/).

## Internal link and image checks

CI validates generated site links with `node scripts/validate-internal-links.mjs`
after `npm run build`. It checks all generated HTML pages for:

- Internal article routes, topic pages, page links and static asset references.
- Local image sources including the **original assets** behind Netlify Image CDN URLs.
- Same-site heading anchors, including table-of-contents links.

It reports the generated page and reference that failed, then fails CI. This
requires no additional dependency and does not make network requests.
**External sites are not tested** (their availability and rate limits are outside
our build's control). Netlify runtime endpoints under `/api/` are excluded
because the static build cannot validate deployed functions.

To run the check locally:

```bash
npm run build
node scripts/validate-internal-links.mjs
```

The checks have fixture-based regression tests in
`scripts/validate-internal-links.test.mjs`.

## Visitor counter configuration

Counters are keyed by a stable, normalized article slug (`luisiitodev:views:v1:<slug>`).
The Netlify Function runs server-side and keeps provider tokens secret:

- `GET /api/counter/<slug>` reads the current global total. Missing Redis keys represent zero new visits.
- `POST /api/counter/<slug>` increments **atomically** via Redis `INCR` and returns the new total.
- Responses are `Cache-Control: no-store`. Errors produce `503`, and the UI displays `— views`, never an invented total.
- These are **page views**, not verified unique visitors. Repeated reloads can count again, and public counters can be abused. Do not use the numbers as a billing or security metric.

### Configure persistent storage

1. Create a **persistent** Redis database on [Upstash](https://console.upstash.com/), not a short-lived trial database. Confirm your plan's pricing and requests quota.
2. In the Netlify site configuration, set both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for **Functions** in the desired production deployment context. Redeploy the site.
3. Run `netlify dev` locally with a private `.env` to test. Astro's `npm run dev` alone does not run Netlify Functions.
4. Visit an article and confirm the count increases. Reload the page and check the count remains stored. Verify the same count in a different browser. Subsequent deploys use the same persistent Redis keys.

**Preserving existing CounterAPI totals:** Keep `COUNTER_API_WORKSPACE` and `COUNTER_API_TOKEN` temporarily, enable `COUNTER_MIGRATE_FROM_COUNTERAPI=true` and redeploy. On the first request for any article, the function reads its old count and initializes the Redis key with atomic `SETNX` (without overwriting any existing Redis value). Visit your previously published articles (or request their GET endpoints) to migrate them. Confirm the totals in Upstash, then remove/disable `COUNTER_MIGRATE_FROM_COUNTERAPI`. Do **not** delete old CounterAPI data until after verification.

Migration will **not** recover values already missing from CounterAPI. If CounterAPI returns an error or a missing counter for a previously published article, migration fails visibly instead of silently seeding zero. Back up the old counts before cutover if possible. During cutover, avoid sending writes to the old provider from a second active deployment, otherwise any late writes after the snapshot are not transferred.

**Important:** A partial configuration does not silently switch to CounterAPI. If Redis is configured but inaccessible, the UI shows unavailable and Netlify logs a diagnostic; correcting provider permissions/connectivity is required.

## Anonymous visitor deduplication and basic abuse protection

The visit endpoint uses **Upstash Redis** for a 24-hour per-article deduplication window.
A `POST /api/counter/<slug>` counts a returning browser only once within that
period. Other browsers can still count individually, even on the same network.
A short-lived, first-party `ldv_visitor` cookie (24 hours, `HttpOnly`, `Secure`,
`SameSite=Lax`) holds a random identifier. Its value is HMAC-hashed before it
is used in Redis keys; the Redis REST token is the server-only HMAC key.

Netlify provides the real visitor IP through `context.ip`; the function does
**not trust** caller-supplied `X-Forwarded-For` headers. Only keyed hashes of
IPs and anonymous identifiers are stored in short-lived Redis keys. The server
limits fresh views to **30 per hour per browser** and **90 per hour per IP**.
A rejected request responds `429` with the current total and no increment.
This is basic abuse mitigation, **not** a guarantee against distributed bots,
proxy rotation or deliberately cleared cookies. Shared network IP limits can
occasionally block legitimate visits, and browsers that reject cookies may
be counted more than once. Consider applicable cookie-notice/consent and
privacy obligations for the blog's visitors before production rollout.

The existing `luisiitodev:views:v1:<slug>` total keys are unchanged; enabling
these controls does not delete or reset current Upstash totals. These limits
apply to Upstash-backed writes. The original CounterAPI fallback remains
available for read compatibility but protected POST requires Redis.

Run regression tests with `node --test scripts/viewProtection.test.mjs`.

## Accessibility baseline

The blog includes a visible-on-focus **Skip to main content** link on every page.
The primary navigation has an explicit accessible name. The dark-mode toggle
uses `aria-pressed` to communicate its current state.

After the Astro build, GitHub Actions runs a zero-dependency accessibility
**smoke check**:

```bash
node scripts/a11y-smoke.mjs dist
node --test scripts/a11y-smoke.test.mjs
```

This checks generated HTML for a language declaration, a meaningful page title,
exactly one main landmark, a working skip link, the presence of `alt` attributes
on images (including intentionally empty `alt=""` for decorative images), and
labels for text inputs. It reports the exact generated page on failure.

**Limitations:** This is NOT a full WCAG audit. It does not assess the quality of
image descriptions, contrast, focus visibility, screen-reader behavior,
keyboard operation of interactive widgets, or dynamic DOM changes. Perform
manual keyboard/screen-reader review and use browser-based tools such as axe
and Lighthouse accessibility for those checks before claiming compliance.

## Lighthouse CI on pull requests

Every PR targeting `master` starts a dedicated [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) workflow alongside the existing build and unit tests:

1. The workflow waits until Netlify reports a **successful Deploy Preview status for the PR head commit**, then verifies that the preview About page is responding. A pending or failed deploy is not mistaken for a ready website.
2. Lighthouse audits the **actual Netlify preview** on mobile settings, including responsive **Netlify Image CDN** transformations that a plain local static server cannot reproduce. It checks three representative pages: `/`, `/about` and `/mcp`.
3. Each page is measured twice and the representative scores for **performance, accessibility, best practices and SEO** are added to the GitHub Actions job summary.
4. Detailed HTML/JSON reports are saved under the `lighthouse-reports-pr-<number>` workflow artifact (14-day retention). Reports are kept in GitHub Actions instead of being uploaded to a public Lighthouse CI storage service.

### Initial score thresholds (advisory)

| Category | Warning threshold |
| --- | ---: |
| Performance | 70 |
| Accessibility | 85 |
| Best practices | 80 |
| SEO | 80 |

Thresholds are expressed on a 0–100 scale. These are **warnings**, not merge gates, because mobile synthetic results vary with the hosted network and CI environment. Failure to collect results or failure to load the correct preview still fails the workflow. After several representative PRs, calibrate baselines before turning stable thresholds into enforced errors.

The preview is public, and Lighthouse may interact with the blog's page-view counter while loading articles. It does not execute privileged admin actions. Avoid adding private URLs or authenticated pages to the collection.

### Reproduce locally

This setup intentionally targets a **deployed Netlify PR Preview** rather than a local static build. To run it yourself for a PR that is already deployed, set `LHCI_PR_NUMBER` and execute:

```bash
npx --yes @lhci/cli@0.15.1 autorun --config=./lighthouserc.cjs
node scripts/summarizeLighthouse.mjs
```

You need Chrome installed. The workflow additionally verifies the Netlify commit status first. The repository contains no Lighthouse reporting credentials.

**Interpretation:** Lighthouse is a lab measurement, not field Core Web Vitals. A passing accessibility score is not WCAG certification, and preview-only indexing directives (if present) can affect its SEO score. For production-level conclusions, also check the published site and real-user metrics.

## English and Spanish (in progress)

**English remains the default.** Existing URLs such as `/about/`, `/mcp/`, and all historical article slugs remain unchanged. Spanish-language navigation uses `/es/`, `/es/about/`, `/es/search/`, and `/es/topics/<tag>/`.

The EN/ES toggle is present in the shared header. Where a genuine translated page exists, it links directly to the equivalent. On original-only English articles, the ES control points to the Spanish landing page instead of publishing misleading duplicate English text under a Spanish URL.

Both landing pages include article cards. Spanish listing titles/descriptions are editorial summaries; articles without a complete Spanish translation are clearly labeled **(en inglés)** and link to the original source. Full translations are stored as versioned Markdown at `src/content/blog/es/<OriginalFileName>.md`; published translated articles have `/es/<original-slug>/` URLs and independent canonical and reciprocal `hreflang` tags. The first four complete translations cover GitHub Actions GH-200, Azure Developer AZ-204, HelloFriend, and C# extension methods. Other technical articles still require editorial translation; **do not describe the entire article archive as bilingual yet**.

To add a translated article:
1. Create `src/content/blog/es/OriginalFileName.md`, preserving its images, links, publication date and tags. Set `lang: 'es'` and translate the title, description and prose without changing code or technical assertions.
2. Add its slug to `translatedArticleSlugs` in `src/utils/i18n.mjs`. Add or update the Spanish listing metadata in `src/utils/spanishContent.mjs`.
3. Verify `/original-slug/` and `/es/original-slug/` render with language-specific title, description, canonical URL and reciprocal `hreflang`, and that switching languages preserves the correct page.
4. Run `node --test scripts/i18n.test.mjs`, `npm run build`, `node scripts/validate-internal-links.mjs` and `node scripts/a11y-smoke.mjs`.

Locale selection uses ordinary crawlable links, without cookies, automatic redirects or machine translation. The English RSS feed remains restricted to original entries. Spanish search keeps its local/noindex behavior.
