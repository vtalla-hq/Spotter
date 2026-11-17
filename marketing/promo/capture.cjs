const { chromium } = require('playwright');
const fs = require('fs');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(800);
  await p.getByRole('button', { name: 'Try a sample cycle' }).click(); await p.waitForTimeout(800);
  await p.addStyleTag({ content: '.fbtn{display:none!important} header{position:static!important}' });
  await p.waitForTimeout(300);
  const off = await p.evaluate(() => {
    const y = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : null; };
    return { verdict: y('.verdict'), h: document.documentElement.scrollHeight };
  });
  await p.screenshot({ path: out + '/app-full.png', fullPage: true });
  fs.writeFileSync(out + '/offsets.json', JSON.stringify(off));
  await p.goto('http://localhost:4173/sources'); await p.waitForTimeout(800);
  await p.addStyleTag({ content: '.fbtn{display:none!important}' });
  await p.screenshot({ path: out + '/app-sources.png' });
  await p.goto('http://localhost:4173/ask'); await p.waitForTimeout(800);
  await p.addStyleTag({ content: '.fbtn{display:none!important}' });
  await p.screenshot({ path: out + '/app-ask.png' });
  await b.close();
})();
