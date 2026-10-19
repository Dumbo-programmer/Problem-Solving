/**
 * E2E smoke with the API attached — the "cloud wins when reachable" path.
 *
 * Builds a second output (`dist-cloud`) with VITE_API_BASE pointed at a local
 * instance of the real Netlify Function, serves it on its own port and runs
 * the standard `scripts/smoke.mjs` journey against it, then tears everything
 * down. `dist/` and the default build are left untouched.
 *
 *   npm run smoke:cloud
 */
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { startApi } from "./api-server.mjs";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "dist-cloud");
const PREVIEW_PORT = Number(process.env.CLOUD_PORT) || 4174;
const API_PORT = Number(process.env.CLOUD_API_PORT) || 8919;
const STORE_FILE = path.join(ROOT, ".data", "cloud-store.json");
const PREVIEW_BASE = `http://localhost:${PREVIEW_PORT}`;
const API_BASE = `http://localhost:${API_PORT}/.netlify/functions/api`;

// Call Vite through its JS bin — spawning npx.cmd would need a shell on Windows.
const VITE = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...opts });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))
    );
    child.on("error", reject);
  });
}

async function waitFor(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

console.log("→ building dist-cloud with VITE_API_BASE …");
rmSync(OUT_DIR, { recursive: true, force: true });
rmSync(STORE_FILE, { force: true }); // fresh store, deterministic seeds
await run(process.execPath, [VITE, "build", "--outDir", "dist-cloud"], {
  cwd: ROOT,
  env: { ...process.env, VITE_API_BASE: API_BASE }
});

console.log("→ starting local API + preview …");
process.env.STORE = "file";
const api = await startApi({ port: API_PORT, storeFile: STORE_FILE, quiet: true });

const preview = spawn(
  process.execPath,
  [VITE, "preview", "--outDir", "dist-cloud", "--port", String(PREVIEW_PORT), "--strictPort", "--logLevel", "warn"],
  { cwd: ROOT, stdio: "inherit" }
);

let failed = false;
try {
  const up = await waitFor(`${PREVIEW_BASE}/`);
  if (!up) throw new Error(`preview did not come up on ${PREVIEW_BASE}`);

  await run(process.execPath, ["scripts/smoke.mjs"], {
    cwd: ROOT,
    env: { ...process.env, BASE_URL: PREVIEW_BASE }
  });
  console.log("\n✓ cloud smoke passed");
} catch (err) {
  failed = true;
  console.error(`\n✗ cloud smoke failed: ${err.message}`);
} finally {
  preview.kill();
  await api.close();
  rmSync(OUT_DIR, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
