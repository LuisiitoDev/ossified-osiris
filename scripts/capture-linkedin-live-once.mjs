import { chromium } from '/tmp/linkedin-capture/node_modules/playwright-core/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const chrome = process.env.CHROME_PATH;
if (!chrome) throw new Error('Chrome executable was not found');
mkdirSync('linkedin-live-captures', { recursive: true });
const browser = await chromium.launch({
  headless: true, executablePath: chrome,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const metadata = {};
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
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
  for (const [key, route, captures] of [
    ['home-en', '/', [['top',0],['articles',700]]],
    ['home-es', '/es/', [['top',0],['articles',720]]],
    ['about-en', '/about/', [['profile',140],['certifications',1940]]],
  ]) {
    const page = await context.newPage();
    const requested = 'https://luisiitodev.com' + route;
    const response = await page.goto(requested, {waitUntil: 'domcontentloaded', timeout: 60000});
    if (!response?.ok()) throw new Error(`HTTP ${response?.status()} on ${requested}`);
    if (new URL(page.url()).origin !== 'https://luisiitodev.com') throw new Error('Unexpected redirect');
    await page.locator('h1').first().waitFor({state: 'visible', timeout: 20000});
    // Do not wait for all lazy below-fold images. Some never load while offscreen.
    await Promise.race([page.evaluate(() => document.fonts.ready), page.waitForTimeout(5000)]);
    metadata[key]={url:page.url(),lang:await page.locator('html').getAttribute('lang'),views:{}};
    for (const [part,y] of captures) {
      await page.evaluate(y => window.scrollTo({ top:y, left:0, behavior:'instant' }), y);
      await page.waitForTimeout(600);
      const state=await page.evaluate(()=>({scrollY,viewportWidth:innerWidth,viewportHeight:innerHeight}));
      const dest=`linkedin-live-captures/${key}-${part}.png`;
      await page.screenshot({path:dest,fullPage:false,animations:'disabled'});
      metadata[key].views[part]={source:dest,...state};
      console.log(JSON.stringify({part,key,url:page.url(),...state}));
    }
    await page.close();
  }
  writeFileSync('linkedin-live-captures/metadata.json', JSON.stringify(metadata,null,2));
} finally {
  await browser.close();
}
