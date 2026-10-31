/**
 * Narrow static accessibility smoke check for generated Astro HTML.
 * This is NOT an axe, WCAG or screen-reader audit. Check critical authoring
 * invariants without fetching external resources or requiring a browser.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function* pages(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, item.name);
    if (item.isDirectory()) yield* pages(file);
    else if (item.isFile() && item.name.endsWith('.html')) yield file;
  }
}

export function checkAccessibleHtml(html) {
  const problems = [];
  // Exclude scripts, styles and comments from structural element checks.
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

  const lang = markup.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!lang?.trim()) problems.push('html element must declare a language');

  const title = markup.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?.replace(/<[^>]+>/g, '').trim();
  if (!title) problems.push('page must have a nonempty title');

  const mains = [...markup.matchAll(/<main\b[^>]*>/gi)].map((m) => m[0]);
  if (mains.length !== 1) problems.push('expected exactly one main landmark');
  else if (!/\bid\s*=\s*["']main-content["']/i.test(mains[0])) {
    problems.push('main landmark must have id="main-content"');
  }

  const skip = markup.match(/<a\b[^>]*\bhref\s*=\s*["']#main-content["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!skip || !skip[1].replace(/<[^>]+>/g, '').trim()) {
    problems.push('missing named skip link to #main-content');
  } else if (mains.length === 1 && markup.indexOf(skip[0]) > markup.indexOf(mains[0])) {
    problems.push('skip link must precede the main content');
  }

  for (const [index, image] of [...markup.matchAll(/<img\b[^>]*>/gi)].entries()) {
    if (!/\balt\s*=\s*(?:"[^"]*"|'[^']*')/i.test(image[0])) {
      problems.push('image #' + (index + 1) + ' has no alt attribute');
    }
  }

  const labels = new Set(
    [...markup.matchAll(/<label\b[^>]*\bfor\s*=\s*["']([^"']+)["']/gi)]
      .map((m) => m[1]),
  );
  for (const [index, input] of [...markup.matchAll(/<input\b[^>]*>/gi)].entries()) {
    const tag = input[0];
    if (/\btype\s*=\s*["']hidden["']/i.test(tag)) continue;
    if (/\baria-label(?:ledby)?\s*=\s*["'][^"']+["']/i.test(tag)) continue;
    const id = tag.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!id || !labels.has(id)) {
      problems.push('input #' + (index + 1) + ' needs a visible or accessible label');
    }
  }
  return problems;
}

export function auditBuiltSite(path) {
  const directory = resolve(path);
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    return { pages: 0, errors: ['Build directory not found: ' + directory] };
  }
  const errors = [];
  let count = 0;
  for (const page of pages(directory)) {
    count++;
    const source = relative(directory, page).split(sep).join('/');
    for (const message of checkAccessibleHtml(readFileSync(page, 'utf8'))) {
      errors.push(source + ': ' + message);
    }
  }
  if (count === 0) errors.push('No HTML pages were generated');
  return { pages: count, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditBuiltSite(process.argv[2] || 'dist');
  console.log('Accessibility smoke check: ' + result.pages + ' generated HTML pages');
  if (result.errors.length) {
    console.error(result.errors.map((error) => '  - ' + error).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('All checked landmarks, skip links, titles, languages, image alts and input labels passed.');
  }
}
