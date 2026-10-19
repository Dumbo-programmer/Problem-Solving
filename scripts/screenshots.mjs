/** Capture full-page screenshots of every route for visual review. */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const OUT = "screenshots";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--force-color-profile=srgb"]
});

const page = await browser.newPage();

for (const theme of ["dark", "light"]) {
  await page.setViewport({ width: 1360, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((t) => {
    window.localStorage.setItem("gonit-ishkul:theme", t);
  }, theme);

  for (const [name, path] of [
    ["home", "/"],
    ["problems", "/problems"],
    ["practice", "/practice"],
    ["about", "/about"]
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1400));
    await page.screenshot({ path: `${OUT}/${name}-${theme}.png`, fullPage: true });
    console.log(`✓ ${name}-${theme}.png`);
  }
}

// Mobile viewport (the responsive check).
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
for (const [name, path] of [
  ["home", "/"],
  ["practice", "/practice"],
  ["problems", "/problems"]
]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1400));
  await page.screenshot({ path: `${OUT}/mobile-${name}.png`, fullPage: true });
  console.log(`✓ mobile-${name}.png`);
}

await browser.close();
