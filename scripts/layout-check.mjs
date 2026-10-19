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
      return { overflow, culprit, hasHeader: !!header, hasFooter: !!footer };
    });

    report(res.overflow <= 1, `${vp.name.padEnd(7)} ${route.padEnd(12)} no horizontal overflow${res.culprit ? ` (culprit: ${res.culprit})` : ""}`);
    report(res.hasHeader && res.hasFooter, `${vp.name.padEnd(7)} ${route.padEnd(12)} header + footer present`);
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
