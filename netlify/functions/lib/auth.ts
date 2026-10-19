import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Credentials + session tokens.
 *
 *   • Staff login  — ADMIN_ID / ADMIN_PASSWORD environment variables (the
 *     documented defaults keep zero-config deployments usable); a12-hour
 *     HMAC-signed bearer, so the dashboard needs no sessions table.
 *   • Learner accounts — username + password, scrypt-hashed in the `users`
 *     table, with a 30-day HMAC-signed bearer.
 *
 * Both token kinds are signed with the same key but carry a `kind` claim, so
 * a learner session can never open an admin route and vice versa.
 */

const DEFAULT_ID = "admin";
const DEFAULT_PASSWORD = "gonit-ishkul";
export const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours (admin)
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (learners)

/* ------------------------------------------------------------------ */
/* Learner account rules                                               */
/* ------------------------------------------------------------------ */

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Digits, optionally with spaces, dashes or a leading + country code. */
const PHONE_RE = /^\+?[0-9][0-9\s-]{7,17}$/;
export const MIN_PASSWORD = 6;
export const MAX_PASSWORD = 72;

/** Lowercases + trims, then validates. Returns the username or null. */
export function normalizeUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const username = raw.trim().toLowerCase();
  return USERNAME_RE.test(username) ? username : null;
}

/** Lowercases + trims, then validates. Returns the email or null. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

/** Strips separators, then validates. Returns the phone digits or null. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const phone = raw.trim();
  if (!PHONE_RE.test(phone)) return null;
  // Canonical form: the digits (and any leading +) with spaces/dashes removed.
  return phone.replace(/[\s-]/g, "");
}

/** Password policy: 6–72 characters (longer values are truncated by bcrypt-style
 *  schemes elsewhere; scrypt takes them fine, but we bound the work either way). */
export function passwordOk(raw: unknown): raw is string {
  return typeof raw === "string" && raw.length >= MIN_PASSWORD && raw.length <= MAX_PASSWORD;
}

/* ------------------------------------------------------------------ */
/* Password hashing (scrypt)                                           */
/* ------------------------------------------------------------------ */

const SCRYPT = { N: 16384, r: 8, p: 1 };

/** `scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>` — params stored for the future. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64, SCRYPT);
  const { N, r, p } = SCRYPT;
  return `scrypt$${N}$${r}$${p}$${salt}$${derived.toString("hex")}`;
}

/** Constant-time password check. Malformed stored values simply fail. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = String(stored).split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, salt, hashHex] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  // Sanity-bound the work so a crafted row can't ask for a gigabyte of memory.
  if (!(Number.isInteger(N) && N >= 1024 && N <= 1 << 20)) return false;
  if (!(Number.isInteger(r) && r >= 1 && r <= 32)) return false;
  if (!(Number.isInteger(p) && p >= 1 && p <= 16)) return false;
  if (!salt || !hashHex) return false;

  let derived: Buffer;
  try {
    derived = scryptSync(password, salt, 64, { N, r, p });
  } catch {
    return false;
  }
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length === 0 || derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/* ------------------------------------------------------------------ */
/* Signing                                                             */
/* ------------------------------------------------------------------ */

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

/** Signing key: ADMIN_SECRET when set, otherwise derived from the password. */
function secret(): string {
  if (process.env.ADMIN_SECRET) return process.env.ADMIN_SECRET;
  return createHmac("sha256", env("ADMIN_PASSWORD", DEFAULT_PASSWORD))
    .update("gonit-ishkul-admin")
    .digest("hex");
}

/** Constant-time comparison that doesn't leak via early exit. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab); // keep the work roughly constant
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** Verifies the submitted admin id + password pair in constant time. */
export function checkCredentials(id: string, password: string): boolean {
  const okId = safeEqual(id, env("ADMIN_ID", DEFAULT_ID));
  const okPassword = safeEqual(password, env("ADMIN_PASSWORD", DEFAULT_PASSWORD));
  return okId && okPassword;
}

type Kind = "admin" | "learner";

function issue(sub: string, kind: Kind, ttlMs: number, now: number): { token: string; expiresAt: number } {
  const expiresAt = now + ttlMs;
  const payload = Buffer.from(JSON.stringify({ sub, kind, exp: expiresAt }), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return { token: `${payload}.${signature}`, expiresAt };
}

function readPayload(token: string | null | undefined, now: number): { sub: string; kind: Kind } | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: unknown;
      kind?: unknown;
      exp?: unknown;
    };
    if (typeof parsed.exp !== "number" || parsed.exp <= now) return null;
    if (typeof parsed.sub !== "string" || parsed.sub.length === 0) return null;
    if (parsed.kind !== "admin" && parsed.kind !== "learner") return null;
    return { sub: parsed.sub, kind: parsed.kind };
  } catch {
    return null;
  }
}

/** Signs the admin bearer token: `<payload>.<signature>`. */
export function signToken(now = Date.now()): { token: string; expiresAt: number } {
  return issue("admin", "admin", TOKEN_TTL_MS, now);
}

/** Validates signature, expiry and kind of an admin token. */
export function verifyToken(token: string | null | undefined, now = Date.now()): boolean {
  const payload = readPayload(token, now);
  return payload !== null && payload.kind === "admin";
}

/** Signs a learner session bearer bound to their user id. */
export function signSession(sub: string, now = Date.now()): { token: string; expiresAt: number } {
  return issue(sub, "learner", SESSION_TTL_MS, now);
}

/** Validates a learner session; returns the user id, or null. */
export function verifySession(token: string | null | undefined, now = Date.now()): string | null {
  const payload = readPayload(token, now);
  return payload && payload.kind === "learner" ? payload.sub : null;
}

/** Pulls the bearer token out of an Authorization header. */
export function bearer(header: string | undefined | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}
