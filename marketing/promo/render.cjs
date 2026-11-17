const { chromium } = require('playwright');
const dir = process.argv[2], fps = 30, dur = 21;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + dir + '/promo.html'); await p.waitForTimeout(2000);
  require('fs').mkdirSync(dir + '/frames', { recursive: true });
  for (let i = 0; i < fps * dur; i++) {
    await p.evaluate((t) => window.render(t), i / fps);
    if (i === Math.round(14.8 * fps) || i === Math.round(13.5*fps)) await p.waitForTimeout(150);
    await p.screenshot({ path: `${dir}/frames/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
  await b.close();
})();
