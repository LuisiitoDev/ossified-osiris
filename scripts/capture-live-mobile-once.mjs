import { chromium } from '/tmp/livecapture/node_modules/playwright-core/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const browserPath = process.env.CHROME_PATH;
if (!browserPath) throw new Error('Chrome executable not available on runner');

const browser = await chromium.launch({
  headless: true,
  executablePath: browserPath,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const results = [];
try {
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  await context.addInitScript(() => {
    try { localStorage.setItem('theme', 'dark'); } catch {}
  });
  mkdirSync('mobile-screenshots', { recursive: true });
  for (const [lang, url] of [
    ['en', 'https://luisiitodev.com/'],
    ['es', 'https://luisiitodev.com/es/'],
  ]) {
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!response || !response.ok()) {
      throw new Error(`Live site returned HTTP ${response?.status()} at ${url}`);
    }
    if (page.url().startsWith('https://deploy-preview')) throw new Error('Unexpected preview redirect');
    await page.locator('h1').first().waitFor({ state: 'visible', timeout: 20000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (const image of document.querySelectorAll('img')) {
        if (image.getBoundingClientRect().top < innerHeight) {
          await (image.decode?.().catch(() => {}) ?? Promise.resolve());
        }
      }
    });
    await page.waitForTimeout(1000);
    const filename = `mobile-screenshots/luisiitodev-live-${lang}-1080x1920.png`;
    await page.screenshot({ path: filename, fullPage: false, animations: 'disabled' });
    const details = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim(),
      lang: document.documentElement.lang,
      origin: location.origin,
      width: innerWidth,
      height: innerHeight,
    }));
    results.push({ requested: url, final: page.url(), filename, ...details });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
  writeFileSync('mobile-screenshots/verification.json', JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
