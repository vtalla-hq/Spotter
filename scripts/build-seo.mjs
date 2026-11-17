// After `vite build`: write the static learn pages, sitemap.xml and robots.txt
// into dist/. The page content comes from src/seo/pages.ts, loaded through Vite
// so it reads the same TypeScript data the app uses.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createServer } from "vite";

const out = "dist";
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const { allPages, sitemap, robots } = await server.ssrLoadModule("/src/seo/pages.ts");
  const pages = allPages();
  for (const p of pages) {
    // /learn/x -> dist/learn/x.html (served at /learn/x with cleanUrls)
    const file = join(out, p.path + ".html");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, p.html);
  }
  writeFileSync(join(out, "sitemap.xml"), sitemap(pages, new Date().toISOString().slice(0, 10)));
  writeFileSync(join(out, "robots.txt"), robots());
  console.log(`SEO: wrote ${pages.length} learn pages, sitemap.xml and robots.txt`);
} finally {
  await server.close();
}
