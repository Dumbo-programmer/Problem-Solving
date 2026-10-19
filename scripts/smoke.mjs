/**
 * End-to-end smoke test against the built site (vite preview).
 *
 * Exercises the real user journey in headless Chrome:
 *   home → problems archive → practice builder → timed test → results → past tests
 *
 * Fails loudly on any console error or blank render.
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const errors = [];
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,900"]
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
page.on("console", (msg) => {
  if (msg.type() !== "error") return;
  // Chrome logs a generic "Failed to load resource … 404" line for the
  // Netlify function, which does not exist under `vite preview`. Same
  // exemption as the response listener below.
  const from = msg.location()?.url || "";
  if (msg.text().includes("Failed to load resource") && from.includes("/.netlify/functions/")) {
    return;
  }
  errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
page.on("response", (res) => {
  // The API only exists under the Netlify runtime (`netlify dev` / production).
  // Locally on `vite preview` these 404s are expected — the app falls back to
  // the bundled bank + localStorage, which is exactly what we want to test.
  if (res.status() >= 400 && !res.url().includes("/.netlify/functions/")) {
    errors.push(`http ${res.status()} — ${res.url().replace(BASE, "")}`);
  }
});

async function goto(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 500));
}

async function text() {
  return page.evaluate(() => document.body.innerText);
}

/* ---------- 1. every route renders ---------- */
for (const path of ["/", "/problems", "/practice", "/past-tests"]) {
  await goto(path);
  const t = await text();
  check(`route ${path} renders`, t.length > 400, `${t.length} chars`);
}

/* ---------- 1b. the retired /about route degrades to the 404 page ---------- */
await goto("/about");
const gone = await text();
check("route /about now shows 404", /404|খুঁজছেন|find/i.test(gone) && gone.length > 400, `${gone.length} chars`);

/* ---------- 2. home shows the problem count ---------- */
await goto("/");
const home = await text();
check("home shows hero copy", /প্র্যাকটিস|practice test/i.test(home));
// The site must present itself as problem-solving themed, with the test
// builder as one part of the platform (not as the whole product).
check("home hero is problem-solving themed", /সমস্যা সমাধান|problem solving/i.test(home));
check("home frames practice tests as one part", /এর একটি অংশ মাত্র|just one part of it/i.test(home));

/* ---------- 3. archive lists problems ---------- */
await goto("/problems");
await page.waitForFunction(() => document.body.innerText.match(/(\d+)\s*(?:মিল|matching)/i) !== null, { timeout: 15000 }).catch(() => {});
const archive = await text();
const countMatch = archive.match(/(\d+)\s*(?:মিল|matching)/i);
check("archive shows a matching count", Boolean(countMatch), countMatch?.[1] ?? "n/a");

/* ---------- 4. filter by a topic chip ---------- */
await goto("/problems?topic=GEOMETRY");
await new Promise((r) => setTimeout(r, 900));
const geomCount = await page.evaluate(() => {
  const m = document.body.innerText.match(/(\d+)\s*(?:মিল|matching)/i);
  return m ? Number(m[1]) : 0;
});
check("topic deep-link filters the archive", geomCount > 0 && geomCount < 144, `${geomCount} geometry problems`);

/* ---------- 5. build + sit a test ---------- */
await goto("/practice");
await new Promise((r) => setTimeout(r, 1200));

// Choose a 5-question paper: click the "5" count preset.
const clicked5 = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "5");
  if (btn) {
    btn.click();
    return true;
  }
  return false;
});
check("question-count preset clickable", clicked5);

// Start the test.
const started = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => /শুরু করুন|Start test/i.test(b.textContent));
  if (btn && !btn.disabled) {
    btn.click();
    return true;
  }
  return false;
});
check("start button enabled with a selection", started);

await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 1200));
const runnerUrl = page.url();
check("test runner route reached", /\/test\/.+/.test(runnerUrl), runnerUrl.replace(BASE, ""));

const runnerText = await text();
check("runner shows a countdown", /\d{2}:\d{2}/.test(runnerText));
check("runner shows question navigation", /প্রশ্ন|Question/i.test(runnerText));

/* ---------- 6. answer every question with a wrong answer, then submit ---------- */
const qCount = await page.evaluate(() => {
  const m = document.body.innerText.match(/(\d+)\s*(?:এর মধ্যে|of)\s*\d+/i);
  return m ? Number(m[1]) : 0;
});

for (let i = 0; i < Math.max(qCount, 1); i++) {
  await page.evaluate(() => {
    const input = document.querySelector('input[id^="ans-"]');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "999999");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  const advanced = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /পরবর্তী|Next/.test(b.textContent));
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  });
  if (!advanced) break;
  await new Promise((r) => setTimeout(r, 350));
}

// Submit (accept the confirm dialog).
page.once("dialog", (d) => d.accept());
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => /টেস্ট জমা|Submit test/i.test(b.textContent));
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 2500));

check("navigated to results", /\/results/.test(page.url()), page.url().replace(BASE, ""));
const resultsText = await text();
check("results show a score", /\d+\s*%/.test(resultsText), resultsText.match(/(\d+)\s*%/)?.[0] ?? "n/a");
check("results show correct-answer boxes", /সঠিক উত্তর|Correct answer/i.test(resultsText));

/* ---------- 7. the test was filed under Past Tests ---------- */
await goto("/past-tests");
await new Promise((r) => setTimeout(r, 1500));
const pastText = await text();
check("past tests list is populated", !/এখনো কোনো টেস্ট নেই|No tests yet/i.test(pastText));
check("past tests show a percentage", /\d+%/.test(pastText));

await browser.close();

/* ---------- report ---------- */
console.log("\n--- console errors ---");
if (errors.length === 0) console.log("(none)");
else errors.slice(0, 20).forEach((e) => console.log(`  • ${e}`));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length || errors.length) process.exit(1);
