/**
 * End-to-end smoke test against the built site (vite preview).
 *
 * Exercises the real user journey in headless Chrome:
 *   home → problems archive → practice builder → timed test → results → past tests
 *
 * Fails loudly on any console error or blank render.
 */
import puppeteer from "puppeteer-core";
import { requireChrome } from "./chrome-path.mjs";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const CHROME = requireChrome();

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

/**
 * Are we on the login gate? Gated routes redirect signed-out visitors to
 * `/login?next=…`, so the URL is the reliable signal.
 */
function gated() {
  return page.url().includes("/login");
}

/**
 * Signs up a throwaway account through the real form. Returns true when the
 * account was created (an API is attached — `smoke:cloud`); false when the app
 * degraded to the offline banner (`vite preview` with no functions).
 */
async function trySignup() {
  await goto("/login?mode=signup");
  const uname = `smoke${Date.now().toString(36)}`;
  await page.evaluate((u) => {
    const set = (id, val) => {
      const el = document.querySelector(id);
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("#auth-name", "Smoke Tester");
    set("#auth-email", `${u}@example.com`);
    set("#auth-phone", "+8801700000000");
    set("#auth-username", u);
    set("#auth-password", "long-enough");
  }, uname);
  await new Promise((r) => setTimeout(r, 100));
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button[type=submit]")].find((b) =>
      /অ্যাকাউন্ট খুলুন|Create account/i.test(b.textContent)
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2500));
  const after = await text();
  return page.url().replace(BASE, "") === "/" && /Smoke Tester/.test(after);
}

/* ---------- 1. every route renders ---------- */
for (const path of ["/", "/problems", "/practice", "/past-tests", "/tests", "/login", "/leaderboard", "/admin"]) {
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
// The design pass added a contests + live-standings section and hero chips.
check("home shows the contests section", /সাপ্তাহিক স্প্রিন্ট|weekly sprint/i.test(home) && /মাসিক চ্যালেঞ্জ|monthly challenge/i.test(home));
check("home previews the live standings", /শীর্ষ সমাধানকারী|top solvers/i.test(home));
check(
  "home carries the hero feature chips",
  /দ্বিভাষিক: বাংলা ও ইংরেজি|Bilingual: Bangla & English/i.test(home) &&
    /সাথে সাথে উত্তর|instant answer/i.test(home)
);
const homePodium = await page.evaluate(() => document.querySelectorAll("span,h3").length);
check("home renders a rich element set", homePodium > 40, `${homePodium} text nodes`);
// Theme pass: co-branded lockup (Prothom Alo above Gonit Ishkul) and the
// "maths in motion" band with its animated SVG plots.
const brand = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll("header img, nav img"));
  return {
    palo: imgs.some((i) => i.src.includes("prothom-alo")),
    gonit: imgs.some((i) => i.src.includes("logo")),
    order: (() => {
      const palo = imgs.find((i) => i.src.includes("prothom-alo"));
      const gonit = imgs.find((i) => i.src.includes("logo"));
      if (!palo || !gonit) return false;
      return Boolean(palo.compareDocumentPosition(gonit) & Node.DOCUMENT_POSITION_FOLLOWING);
    })()
  };
});
check("navbar shows the Prothom Alo mark", brand.palo);
check("navbar shows the Gonit Ishkul logo", brand.gonit);
check("Prothom Alo sits above Gonit Ishkul", brand.order);
check("home carries animated plot SVGs", (await page.evaluate(() => document.querySelectorAll("svg[aria-hidden] path").length)) > 0);
check("home credits the Prothom Alo math school", /প্রথম আলো গণিত ইশকুল|Prothom Alo Math School/i.test(home));
check("footer badges the Prothom Alo partnership", /প্রথম আলো · গণিত ইশকুল|Prothom Alo · Gonit Ishkul/i.test(home));

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
// Past tests are a gated route: signed-out visitors bounce to the login gate.
check("past tests gate signed-out visitors", gated(), page.url().replace(BASE, ""));

/* ---------- 8. scheduled tests are gated for signed-out visitors ---------- */
await goto("/tests");
await new Promise((r) => setTimeout(r, 1200));
check("scheduled tests gate signed-out visitors", gated(), page.url().replace(BASE, ""));
const gateText = await text();
check("login gate explains why sign-in is needed", /সাইন ইন করুন|Sign in to continue/i.test(gateText));

/* ---------- 9. leaderboard is public: anyone may read the board ---------- */
await goto("/leaderboard");
await new Promise((r) => setTimeout(r, 1200));
check("leaderboard is open to everyone", !gated(), page.url().replace(BASE, ""));
const publicBoardText = await text();
check(
  "leaderboard invites signed-out visitors to join",
  /বোর্ডে যোগ দিন|Join the board/i.test(publicBoardText),
  publicBoardText.slice(0, 60)
);

/* ---------- 10. admin dashboard gates on a login form ---------- */
await goto("/admin");
await new Promise((r) => setTimeout(r, 800));
const adminText = await text();
check("admin route shows the login gate", /অ্যাডমিন আইডি|Admin ID/i.test(adminText) && /পাসওয়ার্ড|Password/i.test(adminText));
const hasPasswordField = await page.evaluate(() => Boolean(document.querySelector('input[type="password"]')));
check("admin login has a password field", hasPasswordField);
// The login card must tell the owner which credentials to use.
check(
  "admin login shows the default credentials",
  /ডিফল্ট|Default/i.test(adminText) && /gonit-ishkul/.test(adminText) && /\badmin\b/.test(adminText)
);

/* ---------- 11. learner accounts: /login renders + account journey ---------- */
await goto("/login");
const loginText = await text();
check("login page shows the sign-in form", /ইউজারনেম|Username/i.test(loginText) && /পাসওয়ার্ড|Password/i.test(loginText));
check("login page offers account creation", /নতুন অ্যাকাউন্ট|Create account/i.test(loginText));
check(
  "login page previews a learner dashboard",
  /ড্যাশবোর্ড|Dashboard/i.test(loginText) && /এক নজরে আপনার অগ্রগতি|Your progress, at a glance/i.test(loginText)
);
check("login page shows the public board", /সবার জন্য উন্মুক্ত|Open to everyone/i.test(loginText));

await goto("/login?mode=signup");
const signupText = await text();
check("signup mode asks for a display name", /ডিসপ্লে নাম|Display name/i.test(signupText));
check("signup mode asks for an email", /ইমেইল|Email/i.test(signupText));
check("signup mode asks for a phone number", /মোবাইল নম্বর|Phone number/i.test(signupText));

// Client-side validation must fire before any network call.
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button[type=submit]")].find((b) =>
    /অ্যাকাউন্ট খুলুন|Create account/i.test(b.textContent)
  );
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 400));
const hasAlert = await page.evaluate(() => Boolean(document.querySelector('[role="alert"]')));
check("client-side validation blocks an empty form", hasAlert);

// Full signup journey. With an API attached (smoke:cloud) the account is
// created and the navbar greets the learner; offline it must degrade to the
// bilingual "needs a connection" banner instead of a dead end.
const signedUp = await trySignup();
if (!signedUp) {
  const offlineBanner = await page.evaluate(() => Boolean(document.querySelector('[role="alert"]')));
  check("signup journey completes (or degrades offline)", offlineBanner, "offline banner shown");
} else {
  check("signup journey completes (or degrades offline)", true, "account created + greeted");
}

if (signedUp) {
  /* ---------- 12. signed-in journeys through the gates ---------- */

  // The past-test archive is reachable now.
  await goto("/past-tests");
  await new Promise((r) => setTimeout(r, 1500));
  const pastText = await text();
  check("signed-in: past tests list opens", !gated() && !/এখনো কোনো টেস্ট নেই|No tests yet/i.test(pastText));

  // Scheduled tests: papers, phases, and the winners board that leads the page.
  await goto("/tests");
  await new Promise((r) => setTimeout(r, 1500));
  const testsText = await text();
  check("signed-in: scheduled tests open", !gated() && /নির্ধারিত টেস্ট|Scheduled tests/i.test(testsText));
  check(
    "signed-in: weekly + monthly papers are listed",
    /সাপ্তাহিক স্প্রিন্ট|Weekly Sprint/i.test(testsText) && /মাসিক চ্যালেঞ্জ|Monthly Challenge/i.test(testsText)
  );
  // The winners board promotes the most recent paper's top solvers up top.
  check("signed-in: winners board leads the page", /সাম্প্রতিক টেস্টের বিজয়ী|Recent test winners/i.test(testsText));
  check("signed-in: winners board lists top solvers", /শীর্ষ সমাধানকারী|Top solvers/i.test(testsText));

  // The leaderboard: title, tabs, source, ranked rows and the top-3 podium.
  await goto("/leaderboard");
  await new Promise((r) => setTimeout(r, 1500));
  const lbText = await text();
  check("signed-in: leaderboard opens", !gated() && /লিডারবোর্ড|Leaderboard/i.test(lbText));
  check("signed-in: leaderboard has week/month/all tabs", /এই সপ্তাহ|এই মাস|সব সময়|This week|This month|All time/i.test(lbText));
  check("signed-in: leaderboard names its data source", /অফলাইন|ক্লাউড থেকে|Offline —|Live from the cloud/i.test(lbText));
  check("signed-in: leaderboard lists ranked learners", /র‍্যাঙ্ক|Rank/i.test(lbText));
  const hasPodium = await page.evaluate(() => document.body.innerText.includes("#1"));
  check("signed-in: leaderboard promotes a top-3 podium", hasPodium);

  // Signing out returns the navbar to the signed-out state.
  await goto("/");
  await new Promise((r) => setTimeout(r, 600));
  const loggedOut = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("header button")].find((b) =>
      (b.getAttribute("title") || "").match(/সাইন আউট|Sign out/i)
    );
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  await new Promise((r) => setTimeout(r, 600));
  const afterLogout = await text();
  check("sign-out returns the navbar to 'Sign in'", loggedOut && /সাইন ইন|Sign in/.test(afterLogout));
}


await browser.close();

/* ---------- report ---------- */
console.log("\n--- console errors ---");
if (errors.length === 0) console.log("(none)");
else errors.slice(0, 20).forEach((e) => console.log(`  • ${e}`));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length || errors.length) process.exit(1);
