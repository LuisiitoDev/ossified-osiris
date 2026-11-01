import { chromium } from '/tmp/linkedin-capture/node_modules/playwright-core/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const chrome = process.env.CHROME_PATH;
if (!chrome) throw new Error('Chrome executable was not found');
mkdirSync('linkedin-live-captures', { recursive: true });
const browser = await chromium.launch({
  headless: true, executablePath: chrome,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const info = {};
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
  for (const [key, route] of [
    ['home-en', '/'],
    ['home-es', '/es/'],
    ['about-en', '/about/'],
  ]) {
    const page = await context.newPage();
    const requested = 'https://luisiitodev.com' + route;
    const response = await page.goto(requested, {waitUntil: 'domcontentloaded', timeout: 60000});
    if (!response?.ok()) throw new Error(`HTTP ${response?.status()} on ${requested}`);
    if (!page.url().startsWith(requested)) throw new Error(`Unexpected redirect: ${page.url()}`);
    await page.locator('h1').first().waitFor({state: 'visible', timeout: 20000});
    await page.evaluate(async () => {
      await document.fonts.ready;
      const imgs = [...document.images];
      await Promise.all(imgs.map(img => {
        img.loading='eager';
        return img.decode?.().catch(()=>{}) || Promise.resolve();
      }));
    });
    await page.waitForTimeout(900);
    const details = await page.evaluate(() => {
      const rectOf = el => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x+scrollX, y:r.y+scrollY, width:r.width, height:r.height };
      };
      const headings = [...document.querySelectorAll('h1,h2,h3,h4')]
        .map(e => ({text: e.textContent.trim(),rect:rectOf(e)}));
      return {
        href: location.href, title: document.title, lang: document.documentElement.lang,
        deviceCssWidth: innerWidth, documentCssHeight: document.documentElement.scrollHeight,
        headings,
        profile: rectOf(document.querySelector('img[alt="Luis Sandoval"]')),
        certificates: headings.filter(x=>/Certifications|Credentials/i.test(x.text)),
      };
    });
    if ((key==='home-en' && details.lang!=='en') || (key==='home-es' && details.lang!=='es')) {
      throw new Error(`Unexpected language on ${key}: ${details.lang}`);
    }
    const path='linkedin-live-captures/' + key + '-full.png';
    await page.screenshot({path, fullPage:true, animations:'disabled'});
    info[key]=details;
    console.log(JSON.stringify({key,href:details.href,lang:details.lang,height:details.documentCssHeight,headings:details.headings.map(h=>({text:h.text,y:h.rect?.y}))}));
    await page.close();
  }
  writeFileSync('linkedin-live-captures/metadata.json', JSON.stringify(info,null,2));
} finally {
  await browser.close();
}
