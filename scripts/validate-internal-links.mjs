/**
 * Validate local links/assets against Astro's generated dist/ output.
 * External HTTP(S) links are intentionally excluded.
 * Usage: node scripts/validate-internal-links.mjs [dist-directory]
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ORIGIN = 'https://luisiitodev.com';

function* htmlFiles(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, item.name);
    if (item.isDirectory()) yield* htmlFiles(fullPath);
    else if (item.isFile() && item.name.endsWith('.html')) yield fullPath;
  }
}

export function pageUrlForFile(root, file) {
  const relativePath = relative(root, file).split(sep).join('/');
  if (relativePath === 'index.html') return '/';
  if (relativePath.endsWith('/index.html')) return '/' + relativePath.slice(0, -'index.html'.length);
  return '/' + relativePath;
}

function referencedAttributes(html) {
  const tags = /<(a|img|source|link|script)\b[^>]*>/gi;
  const attributes = /\b(href|src|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  const references = [];
  for (const tag of html.matchAll(tags)) {
    for (const match of tag[0].matchAll(attributes)) {
      const name = match[1].toLowerCase();
      const value = (match[2] ?? match[3] ?? '').replace(/&amp;|&#38;|&#x26;/gi, '&');
      const values = name === 'srcset'
        ? value.split(',').map((entry) => entry.trim().split(/\s+/)[0]).filter(Boolean)
        : [value];
      for (const candidate of values) {
        if (candidate && !candidate.startsWith('data:')) {
          references.push({ candidate, attribute: name });
        }
      }
    }
  }
  return references;
}

function localTarget(root, targetUrl) {
  let pathname;
  try { pathname = decodeURIComponent(targetUrl.pathname); }
  catch { return { error: 'malformed URL encoding' }; }
  // Netlify Functions are runtime endpoints and not present in static dist/.
  if (pathname.startsWith('/api/')) return { dynamic: true };
  const targetPath = resolve(root, '.' + pathname);
  if (targetPath !== root && !targetPath.startsWith(root + sep)) {
    return { error: 'path escapes the generated site' };
  }
  if (existsSync(targetPath) && statSync(targetPath).isFile()) return { file: targetPath };
  const asIndex = join(targetPath, 'index.html');
  if (existsSync(asIndex) && statSync(asIndex).isFile()) return { file: asIndex };
  if (!extname(targetPath)) {
    const asHtml = targetPath + '.html';
    if (existsSync(asHtml) && statSync(asHtml).isFile()) return { file: asHtml };
  }
  return { error: 'target not found in dist/' };
}

export function validateBuiltSite(dir) {
  const root = resolve(dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return { files: 0, references: 0, errors: ['Build output not found: ' + root] };
  }
  const errors = [];
  const htmlCache = new Map();
  const files = [...htmlFiles(root)];
  let references = 0;
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const pageUrl = pageUrlForFile(root, file);
    const sourceLabel = relative(root, file).split(sep).join('/');
    for (const { candidate, attribute } of referencedAttributes(html)) {
      let url;
      try { url = new URL(candidate, SITE_ORIGIN + pageUrl); }
      catch { errors.push(sourceLabel + ' [' + attribute + ']: invalid URL ' + candidate); continue; }
      if (url.origin !== SITE_ORIGIN) continue;
      references += 1;
      // Netlify Image CDN URLs are virtual: verify the original asset in ?url=.
      if (url.pathname === '/.netlify/images') {
        const source = url.searchParams.get('url');
        if (!source || !source.startsWith('/') || source.startsWith('//')) {
          errors.push(sourceLabel + ': invalid Netlify image source in ' + candidate);
          continue;
        }
        url = new URL(source, SITE_ORIGIN);
      }
      const target = localTarget(root, url);
      if (target.error) {
        errors.push(sourceLabel + ' [' + attribute + ']: ' + candidate + ' (' + target.error + ')');
        continue;
      }
      if (target.dynamic || !url.hash || url.hash === '#' || url.hash.startsWith('#:~:text=')) continue;
      if (!target.file.endsWith('.html')) continue;
      let fragment;
      try { fragment = decodeURIComponent(url.hash.slice(1)); }
      catch { errors.push(sourceLabel + ': invalid fragment in ' + candidate); continue; }
      if (!fragment) continue;
      if (!htmlCache.has(target.file)) htmlCache.set(target.file, readFileSync(target.file, 'utf8'));
      const destHtml = htmlCache.get(target.file);
      const ids = [...destHtml.matchAll(/\bid=(?:"([^"]*)"|'([^']*)')/g)]
        .map((m) => m[1] ?? m[2]);
      if (!ids.includes(fragment)) {
        errors.push(sourceLabel + ': anchor not found for ' + candidate);
      }
    }
  }
  return { files: files.length, references, errors };
}

const invokedAsScript = process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  const result = validateBuiltSite(process.argv[2] || 'dist');
  console.log('Checked ' + result.files + ' generated HTML pages and ' +
    result.references + ' local links/assets.');
  if (result.errors.length) {
    console.error(result.errors.map((msg) => '  - ' + msg).join('\n'));
    console.error('Found ' + result.errors.length + ' broken local references.');
    process.exitCode = 1;
  } else {
    console.log('All local routes, anchors and static assets resolved.');
  }
}
