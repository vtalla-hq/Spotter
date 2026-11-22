/**
 * Renders every case in three forms:
 *   <id>.pdf        text-layer PDF (Chromium print)
 *   <id>.scan.pdf   image-only PDF: each page rasterised at ~200 dpi, lightly rotated and speckled
 *   <id>.photo.jpg  page 1 as a phone photo: keystone, rotation, blur, low contrast, uneven light, JPEG
 * and writes <id>.json labels. Usage: npx tsx evals/gen/render.ts [--only quest-03]
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { allCases, DATASET, rng, SEED } from "./cases";
import { RENDER } from "./layouts";

const OUT = join(import.meta.dirname, "..", "data", DATASET);
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

interface Degrade {
  rot: number;
  keystone: number;
  blur: number;
  contrast: number;
  bright: number;
  light: number;
  quality: number;
  width: number;
}

/** Runs in the page: draws the screenshot like a hand-held phone photo of a sheet on a desk. */
async function photo(page: Page, png: Buffer, d: Degrade): Promise<Buffer> {
  const url = await page.evaluate(
    async ({ src, d }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const W = d.width;
      const H = Math.round(W * 4 / 3);
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const x = c.getContext("2d")!;
      // desk
      x.fillStyle = "#6b6157";
      x.fillRect(0, 0, W, H);
      // sheet with keystone: draw in horizontal strips, narrower toward the top
      const sw = W * 0.9;
      const sh = (sw * img.height) / img.width;
      const sheet = document.createElement("canvas");
      sheet.width = W;
      sheet.height = H;
      const s = sheet.getContext("2d")!;
      s.imageSmoothingQuality = "high";
      const top = (H - sh) / 2;
      const strips = 200;
      for (let i = 0; i < strips; i++) {
        const t = i / strips;
        const k = 1 - d.keystone * (1 - t);
        const w = sw * k;
        s.drawImage(img, 0, (img.height * i) / strips, img.width, img.height / strips + 1, (W - w) / 2, top + sh * t, w, sh / strips + 1);
      }
      x.save();
      x.translate(W / 2, H / 2);
      x.rotate((d.rot * Math.PI) / 180);
      x.translate(-W / 2, -H / 2);
      x.filter = `blur(${d.blur}px) contrast(${d.contrast}) brightness(${d.bright})`;
      x.drawImage(sheet, 0, 0);
      x.restore();
      // uneven light: a soft shadow from one corner
      const g = x.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, `rgba(255,250,235,${d.light * 0.4})`);
      g.addColorStop(1, `rgba(20,15,10,${d.light})`);
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
      return c.toDataURL("image/jpeg", d.quality);
    },
    { src: "data:image/png;base64," + png.toString("base64"), d },
  );
  return Buffer.from(url.split(",")[1], "base64");
}

/** Runs in the page: a flatbed-style scan, nearly straight with a little speckle. */
async function scan(page: Page, png: Buffer, rot: number, seed: number): Promise<string> {
  return page.evaluate(
    async ({ src, rot, seed }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext("2d")!;
      x.fillStyle = "#fff";
      x.fillRect(0, 0, c.width, c.height);
      x.translate(c.width / 2, c.height / 2);
      x.rotate((rot * Math.PI) / 180);
      x.drawImage(img, -img.width / 2, -img.height / 2);
      x.setTransform(1, 0, 0, 1, 0, 0);
      let a = seed;
      const r = () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      x.fillStyle = "rgba(0,0,0,0.35)";
      for (let i = 0; i < 1500; i++) x.fillRect(r() * c.width, r() * c.height, 1 + r() * 1.5, 1 + r() * 1.5);
      return c.toDataURL("image/jpeg", 0.7);
    },
    { src: "data:image/png;base64," + png.toString("base64"), rot, seed },
  );
}

async function main() {
  if (!only) rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  // tsx (esbuild) wraps named functions in __name(); give evaluated code a no-op
  const shim = "window.__name = (f) => f";
  const hi = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 200 / 96 });
  const ph = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 1.5 });
  const cases = allCases().filter(({ c }) => !only || c.id === only);
  for (const { c, label } of cases) {
    const r = rng(SEED * 7 + c.id.split("").reduce((a, ch) => a * 31 + ch.charCodeAt(0), 0));
    const html = RENDER[c.layout](c);
    writeFileSync(join(OUT, `${c.id}.json`), JSON.stringify(label, null, 2) + "\n");

    // text-layer PDF
    await hi.setContent(html, { waitUntil: "load" });
    await hi.evaluate(shim);
    writeFileSync(join(OUT, `${c.id}.pdf`), await hi.pdf({ width: "8.5in", height: "11in", printBackground: true, preferCSSPageSize: true }));

    // image-only PDF
    const shots: string[] = [];
    for (const el of await hi.$$(".page")) shots.push(await scan(hi, await el.screenshot(), r.range(-0.6, 0.6), r.int(1, 1e6)));
    const scanHtml = `<!doctype html><html><head><style>@page{size:8.5in 11in;margin:0}body{margin:0}img{width:8.5in;height:11in;display:block;page-break-after:always}</style></head><body>${shots
      .map((s) => `<img src="${s}">`)
      .join("")}</body></html>`;
    await hi.setContent(scanHtml, { waitUntil: "load" });
    await hi.evaluate(shim);
    writeFileSync(join(OUT, `${c.id}.scan.pdf`), await hi.pdf({ width: "8.5in", height: "11in", preferCSSPageSize: true }));

    // phone photo of page 1
    await ph.setContent(html, { waitUntil: "load" });
    await ph.evaluate(shim);
    const first = await (await ph.$(".page"))!.screenshot();
    const sev = r.next(); // 0 = mild, 1 = harsh
    const d: Degrade = {
      rot: (r.chance(0.5) ? -1 : 1) * r.range(1, 4),
      keystone: r.range(0.01, 0.06),
      blur: 0.3 + sev * 1.0,
      contrast: 0.9 - sev * 0.3,
      bright: r.range(0.92, 1.05),
      light: r.range(0.05, 0.3),
      quality: r.range(0.6, 0.8),
      width: r.pick([1200, 1500, 1800]),
    };
    writeFileSync(join(OUT, `${c.id}.photo.jpg`), await photo(ph, first, d));
    process.stdout.write(".");
  }
  await browser.close();
  console.log(`\n${cases.length} cases → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
