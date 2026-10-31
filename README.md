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

The view counter uses `netlify/functions/counter.js`. Set `COUNTER_API_WORKSPACE` and `COUNTER_API_TOKEN` in Netlify environment settings, **never in committed files**. Refer to `.env.example` and run `netlify dev` when testing serverless functions locally.

## Validation

GitHub Actions runs `.github/workflows/blog-ci.yml`, which checks the unit tests, Astro build, generated RSS and sitemap, search-page indexing behavior and the Spanish article language metadata.

CI checks do not substitute for mobile accessibility review, production performance measurements or Netlify Deploy Preview testing. Do not infer a Lighthouse score from the Astro starter template.

## Attribution

This blog was originally based on the [Astro Blog template](https://github.com/withastro/astro/tree/main/examples/blog), which credits [Bear Blog](https://github.com/HermanMartinus/bearblog/).
