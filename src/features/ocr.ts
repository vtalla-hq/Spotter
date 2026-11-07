/**
 * Turns a lab report file into text, entirely in the browser.
 *  - PDFs from a lab portal usually have a text layer: read it with pdf.js and
 *    rebuild rows from each word's position, so table columns stay on one line.
 *  - Scanned PDFs and photos have no text: render them and run Tesseract OCR.
 * Both libraries are loaded on demand, and the OCR engine and model are served
 * from this site (public/ocr), so a report never leaves the device.
 */

export type Progress = (msg: string, pct?: number) => void;

export interface Extracted {
  text: string;
  method: "pdf-text" | "ocr";
  pages: number;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ---------- PDF text layer
interface Word {
  str: string;
  x: number;
  y: number;
  w: number;
}

/** Group words into lines by their y position, then order each line left to right. */
export function wordsToLines(words: Word[], tol = 3): string[] {
  const rows: { y: number; ws: Word[] }[] = [];
  for (const w of words) {
    if (!w.str.trim()) continue;
    const r = rows.find((r) => Math.abs(r.y - w.y) <= tol);
    if (r) r.ws.push(w);
    else rows.push({ y: w.y, ws: [w] });
  }
  // PDF y grows upward
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    const ws = r.ws.sort((a, b) => a.x - b.x);
    let out = "";
    let end = -Infinity;
    for (const w of ws) {
      // a wide gap is a column break: keep it visible so numbers don't merge
      if (out) out += w.x - end > 12 ? "   " : w.x - end > 1 ? " " : "";
      out += w.str;
      end = w.x + w.w;
    }
    return out.trim();
  });
}

async function loadPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

// ---------- OCR
type TWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;

async function ocrWorker(progress: Progress, label: () => string): Promise<TWorker> {
  const { createWorker, OEM } = await import("tesseract.js");
  const w = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: `${BASE}/ocr/worker.min.js`,
    corePath: `${BASE}/ocr`,
    langPath: `${BASE}/ocr/lang`,
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") progress(label(), Math.round(m.progress * 100));
      else if (/load|initializ/.test(m.status)) progress("Loading the text reader (first time only)…");
    },
  });
  // keep runs of spaces so table columns stay apart
  await w.setParameters({ preserve_interword_spaces: "1" });
  return w;
}

/** Grey, upscaled copy of an image. Small, colourful phone photos OCR much better this way. */
export function prepCanvas(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const scale = w < 1600 ? Math.min(3, 1600 / w) : w > 3200 ? 3200 / w : 1;
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, c.width, c.height);
  const img = x.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  x.putImageData(img, 0, 0);
  return c;
}

async function imageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file).catch(() => {
    throw new Error("Couldn't open that image. Try a JPG or PNG, or a screenshot of the report.");
  });
  const c = prepCanvas(bmp, bmp.width, bmp.height);
  bmp.close();
  return c;
}

export async function extractText(file: File, progress: Progress): Promise<Extracted> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) {
    progress("Opening PDF…");
    const pdf = await loadPdf(file);
    const lines: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const words = (tc.items as { str?: string; transform?: number[]; width?: number }[])
        .filter((it) => typeof it.str === "string" && it.transform)
        .map((it) => ({ str: it.str!, x: it.transform![4], y: it.transform![5], w: it.width ?? 0 }));
      lines.push(...wordsToLines(words));
    }
    const text = lines.join("\n");
    // a real text layer has plenty of characters per page; scans have none
    if (text.replace(/\s/g, "").length >= 60 * pdf.numPages) return { text, method: "pdf-text", pages: pdf.numPages };

    let page = 0;
    const w = await ocrWorker(progress, () => `Reading page ${page} of ${pdf.numPages}…`);
    try {
      const out: string[] = [];
      for (page = 1; page <= pdf.numPages; page++) {
        progress(`Reading page ${page} of ${pdf.numPages}…`, 0);
        const pg = await pdf.getPage(page);
        const vp = pg.getViewport({ scale: 2.5 });
        const c = document.createElement("canvas");
        c.width = vp.width;
        c.height = vp.height;
        await pg.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp }).promise;
        const r = await w.recognize(prepCanvas(c, c.width, c.height));
        out.push(r.data.text);
      }
      return { text: out.join("\n"), method: "ocr", pages: pdf.numPages };
    } finally {
      await w.terminate();
    }
  }

  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(file.name))
    throw new Error("That file type isn't supported. Use a PDF, or a JPG or PNG photo or screenshot.");
  progress("Preparing image…");
  const canvas = await imageToCanvas(file);
  const w = await ocrWorker(progress, () => "Reading your report…");
  try {
    const r = await w.recognize(canvas);
    return { text: r.data.text, method: "ocr", pages: 1 };
  } finally {
    await w.terminate();
  }
}
