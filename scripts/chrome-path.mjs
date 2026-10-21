/**
 * Locates a Chromium-family browser for the headless QA scripts.
 *
 * The scripts used to hardcode one install path, which broke on any machine
 * that installs Chrome per-user (or uses Edge / Brave). `CHROME_PATH` always
 * wins; otherwise the well-known locations are tried in order.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  join(process.env.LOCALAPPDATA ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
  "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"
];

/** The browser executable to drive, or null when nothing was found. */
export function findChrome() {
  const explicit = process.env.CHROME_PATH;
  if (explicit && existsSync(explicit)) return explicit;
  for (const path of CANDIDATES) {
    if (path && existsSync(path)) return path;
  }
  return null;
}

/** The browser executable to drive; throws a helpful error when none exists. */
export function requireChrome() {
  const path = findChrome();
  if (!path) {
    throw new Error(
      "No Chromium browser found. Install Chrome or Edge, or set CHROME_PATH to the executable."
    );
  }
  return path;
}
