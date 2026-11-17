import { describe, expect, it } from "vitest";
import { allPages, robots, sitemap, slug } from "./pages";
import { COMP } from "../engine/data/compounds";
import { BYID } from "../engine/data/markers";

describe("learn pages", () => {
  const pages = allPages();
  it("has one page per marker and compound, with unique paths", () => {
    expect(new Set(pages.map((p) => p.path)).size).toBe(pages.length);
    expect(pages.length).toBe(1 + Object.keys(BYID).length + COMP.length);
  });
  it("only links to pages that exist", () => {
    const paths = new Set(pages.map((p) => p.path));
    for (const p of pages)
      for (const [, href] of p.html.matchAll(/href="(\/learn[^"#]*)"/g)) expect(paths.has(href), `${p.path} -> ${href}`).toBe(true);
  });
  it("turns every source ref into a numbered link and leaves no raw refs", () => {
    for (const p of pages) expect(p.html, p.path).not.toMatch(/\[P\d+\]/);
    const hct = pages.find((p) => p.path === "/learn/hematocrit")!;
    expect(hct.html).toContain('href="#src-P3"');
    expect(hct.html).toContain("Testosterone (TRT dose)");
  });
  it("escapes text and keeps titles and descriptions search-friendly", () => {
    for (const p of pages) {
      expect(p.title.length, p.path).toBeLessThan(90);
      expect(p.description.length, p.path).toBeLessThanOrEqual(300);
      expect(p.html).toContain(`<link rel="canonical" href="https://spotterlabs.vercel.app${p.path}">`);
    }
  });
  it("makes clean slugs", () => {
    expect(slug("Testosterone (TRT dose)")).toBe("testosterone");
    expect(slug("Testosterone (TRT dose)", true)).toBe("testosterone-trt-dose");
    expect(slug("Ipamorelin / CJC-1295")).toBe("ipamorelin-cjc-1295");
  });
  it("writes a sitemap and robots.txt", () => {
    const xml = sitemap(pages, "2026-11-17");
    expect(xml).toContain("<loc>https://spotterlabs.vercel.app/learn/hematocrit</loc>");
    expect(xml).toContain("<loc>https://spotterlabs.vercel.app/bloodwork/hematocrit</loc>");
    expect(robots()).toContain("Sitemap: https://spotterlabs.vercel.app/sitemap.xml");
  });
});
