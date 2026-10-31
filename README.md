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
