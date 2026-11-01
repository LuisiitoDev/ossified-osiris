// Genuine browser regression: evaluate actual Netlify Deploy Preview in Chrome.
import { chromium } from '/tmp/nav-check/node_modules/playwright-core/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const number = process.env.LHCI_PR_NUMBER;
const preview = `https://deploy-preview-${number}--luiistodev.netlify.app`;
const chrome = process.env.CHROME_PATH;
if (!/^\d+$/.test(number ?? '') || !chrome) throw new Error('Missing PR number or Chrome');
const browser = await chromium.launch({
  executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const records = [];
mkdirSync('mobile-nav-screenshots', { recursive: true });
try {
  for (const locale of ['en', 'es']) {
    for (const width of [320, 375, 390, 430, 768]) {
      const mobile = width < 640;
      const context = await browser.newContext({
        viewport: { width, height: 750 }, deviceScaleFactor: 2,
        isMobile: mobile, hasTouch: mobile, colorScheme: 'dark',
      });
      const page = await context.newPage();
      const url = preview + (locale === 'en' ? '/' : '/es/');
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (!response?.ok()) throw new Error(`HTTP ${response?.status()} at ${url}`);
      await page.locator('header nav').waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready);
      const dimensions = await page.evaluate(() => {
        const nav = document.querySelector('header nav');
        const rect = nav.getBoundingClientRect();
        return {
          innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          navLeft: rect.left,
          navRight: rect.right,
          logoWidth: nav.querySelector('.brand-link')?.getBoundingClientRect().width,
        };
      });
      if (dimensions.scrollWidth > width + 1 || dimensions.navLeft < -1 ||
          dimensions.navRight > width + 1) {
        throw new Error(`Horizontal overflow ${locale} at ${width}: ${JSON.stringify(dimensions)}`);
      }

      const dropdown = page.locator('header details.mobile-menu');
      const links = page.locator('header .internal-links');
      if (mobile) {
        if (!await dropdown.isVisible() || await links.isVisible()) {
          throw new Error(`Expected collapsed navigation in ${locale} at ${width}`);
        }
        await dropdown.locator('summary').click();
        const panel = page.locator('header .mobile-menu-panel');
        if (!await panel.isVisible()) throw new Error('Mobile dropdown did not open');
        const bounds = await panel.boundingBox();
        if (!bounds || bounds.x < -1 || bounds.x + bounds.width > width + 1) {
          throw new Error(`Dropdown clipped on ${width}: ${JSON.stringify(bounds)}`);
        }
        const menuLinks = panel.locator('a');
        const expected = locale === 'en' ? ['Home','About'] : ['Inicio','Acerca de mí'];
        const actual = await menuLinks.allTextContents();
        if (actual.map(x=>x.trim()).join('|') !== expected.join('|')) {
          throw new Error(`Wrong localized navigation: ${JSON.stringify(actual)}`);
        }
        await page.keyboard.press('Escape');
        if (await dropdown.getAttribute('open') !== null) throw new Error('Escape did not close mobile menu');
        await dropdown.locator('summary').click();
        await page.locator('main').click({ position: {x: 15,y: 15} });
        if (await dropdown.getAttribute('open') !== null) throw new Error('Outside interaction did not close mobile menu');
        await dropdown.locator('summary').click();
        await menuLinks.last().click();
        await page.waitForURL(url.replace(/\/$/, '') + '/about/');
        if (!await page.locator('header details.mobile-menu').isVisible()) throw new Error('Mobile navbar lost after navigation');
      } else {
        if (await dropdown.isVisible() || !await links.isVisible()) {
          throw new Error(`Expected desktop links at ${width}`);
        }
      }
      const langSwitch = page.locator('header a[hreflang]');
      if (!await langSwitch.isVisible()) throw new Error('Missing visible language switch');
      const theme = page.locator('#theme-toggle');
      if (!await theme.isVisible()) throw new Error('Theme toggle hidden');
      await page.screenshot({ path: `mobile-nav-screenshots/${locale}-${width}.png`, animations: 'disabled' });
      records.push({locale,width,...dimensions,passed:true});
      await context.close();
    }
  }
  writeFileSync('mobile-nav-screenshots/results.json', JSON.stringify(records,null,2));
  console.log('Responsive nav verified on 10 browser viewport / locale combinations');
} finally {
  await browser.close();
}
