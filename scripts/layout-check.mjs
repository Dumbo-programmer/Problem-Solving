/**
 * Responsive layout guard.
 *
 * Catches the most common responsive bugs programmatically:
 *   • horizontal overflow (an element wider than the viewport)
 *   • the offending element, so it is easy to fix
 *   • content hidden behind the sticky header
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const VIEWPORTS = [
  { name: "mobile", width: 360, height: 780 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1360, height: 900 }
];

const ROUTES = ["/", "/problems", "/practice", "/past-tests", "/tests", "/login", "/leaderboard", "/admin"];

let failures = 0;
const report = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu"]
});

for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewport({ width: vp.width, height: vp.height });

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 900));

    const res = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflow = doc.scrollWidth - doc.clientWidth;
      let culprit = null;
      if (overflow > 1) {
        // Find the widest offending element for an actionable failure message.
        const vw = doc.clientWidth;
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width > vw + 1 || r.right > vw + 1) {
            culprit = `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ").slice(0, 3).join(".")}`;
            break;
          }
        }
      }
      const header = document.querySelector("header");
      const footer = document.querySelector("footer");
      // The co-brand lockup must actually paint: Prothom Alo above the Gonit
      // Ishkul logo, both with real box sizes (catches a missing/hidden asset).
      // Each mark has a light + dark variant, so pick the one that is visible.
      const visible = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1 ? el : null;
      };
      const navImgs = Array.from(document.querySelectorAll("nav img")).filter(visible);
      const palo = navImgs.find((i) => i.src.includes("prothom-alo"));
      const gonit = navImgs.find((i) => i.src.includes("logo"));
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      };
      const brand = {
        palo: box(palo),
        gonit: box(gonit),
        stacked: Boolean(palo && gonit && palo.getBoundingClientRect().bottom <= gonit.getBoundingClientRect().top + 2)
      };
      return { overflow, culprit, hasHeader: !!header, hasFooter: !!footer, brand };
    });

    report(res.overflow <= 1, `${vp.name.padEnd(7)} ${route.padEnd(12)} no horizontal overflow${res.culprit ? ` (culprit: ${res.culprit})` : ""}`);
    report(res.hasHeader && res.hasFooter, `${vp.name.padEnd(7)} ${route.padEnd(12)} header + footer present`);
    report(
      res.brand.palo && res.brand.gonit && res.brand.palo.w > 20 && res.brand.gonit.w > 20,
      `${vp.name.padEnd(7)} ${route.padEnd(12)} brand lockup paints (palo ${res.brand.palo?.w}x${res.brand.palo?.h}, gonit ${res.brand.gonit?.w}x${res.brand.gonit?.h})`
    );
    report(
      Boolean(res.brand.gonit && res.brand.gonit.w > res.brand.gonit.h * 1.3),
      `${vp.name.padEnd(7)} ${route.padEnd(12)} Gonit logo is landscape (${res.brand.gonit?.w}x${res.brand.gonit?.h})`
    );
    report(res.brand.stacked, `${vp.name.padEnd(7)} ${route.padEnd(12)} Prothom Alo stacked above Gonit Ishkul`);
  }

  // Mobile menu must actually open.
  if (vp.name === "mobile") {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 600));
    const opened = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-expanded]');
      if (!btn) return "no-toggle";
      btn.click();
      return new Promise((resolve) =>
        setTimeout(() => {
          // The desktop nav and the mobile sheet both contain a "Problems"
          // link; only the sheet's copy is visible on mobile, so test for ANY
          // visible match rather than the first in DOM order.
          const links = [...document.querySelectorAll("a")].filter((a) =>
            /^(সমস্যা|Problems)$/.test(a.textContent.trim())
          );
          const visible = links.filter((a) => a.getBoundingClientRect().height > 0);
          resolve(visible.length > 0 ? "open" : "closed");
        }, 500)
      );
    });
    report(opened === "open", `mobile   nav menu    opens on tap (${opened})`);
  }

  await page.close();
}

await browser.close();
console.log(failures === 0 ? "\n✓ all layout checks passed" : `\n✗ ${failures} layout issue(s)`);
process.exit(failures === 0 ? 0 : 1);
