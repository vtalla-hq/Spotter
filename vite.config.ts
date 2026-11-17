import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { ocrVersion } from "./scripts/ocr-version.mjs";

export default defineConfig({
  plugins: [react()],
  define: {
    __OCR_VER__: JSON.stringify(ocrVersion()),
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
