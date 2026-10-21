/** Capture full-page screenshots of every route for visual review. */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { requireChrome } from "./chrome-path.mjs";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const OUT = "screenshots";
const CHROME = requireChrome();

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--force-color-profile=srgb"]
});

const page = await browser.newPage();

await page.setViewport({ width: 1360, height: 900, deviceScaleFactor: 1 });

for (const [name, path] of [
  ["home", "/"],
  ["problems", "/problems"],
  ["practice", "/practice"],
  ["contests", "/contests"],
  ["leaderboard", "/leaderboard"]
]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1400));
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`✓ ${name}.png`);
}

// Mobile viewport (the responsive check).
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
for (const [name, path] of [
  ["home", "/"],
  ["practice", "/practice"],
  ["problems", "/problems"],
  ["contests", "/contests"]
]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1400));
  await page.screenshot({ path: `${OUT}/mobile-${name}.png`, fullPage: true });
  console.log(`✓ mobile-${name}.png`);
}

await browser.close();
