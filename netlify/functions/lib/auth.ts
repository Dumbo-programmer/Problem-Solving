import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Admin credentials + session tokens.
 *
 * The dashboard is guarded by a single staff login. Credentials come from the
 * ADMIN_ID / ADMIN_PASSWORD environment variables (documented defaults keep
 * zero-config deployments usable); the token is an HMAC-signed, expiring
 * bearer so no sessions or tables are needed to stay logged in.
 */

const DEFAULT_ID = "admin";
const DEFAULT_PASSWORD = "gonit-ishkul";
export const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

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

/** Verifies the submitted id + password pair in constant time. */
export function checkCredentials(id: string, password: string): boolean {
  const okId = safeEqual(id, env("ADMIN_ID", DEFAULT_ID));
  const okPassword = safeEqual(password, env("ADMIN_PASSWORD", DEFAULT_PASSWORD));
  return okId && okPassword;
}

/** Signs an expiring bearer token: `<payload>.<signature>`. */
export function signToken(now = Date.now()): { token: string; expiresAt: number } {
  const expiresAt = now + TOKEN_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ sub: "admin", exp: expiresAt }), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return { token: `${payload}.${signature}`, expiresAt };
}

/** Validates signature + expiry of a bearer token. */
export function verifyToken(token: string | null | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof parsed.exp === "number" && parsed.exp > now;
  } catch {
    return false;
  }
}

/** Pulls the bearer token out of an Authorization header. */
export function bearer(header: string | undefined | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}
