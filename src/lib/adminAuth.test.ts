import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  bearer,
  checkCredentials,
  signToken,
  verifyToken,
  TOKEN_TTL_MS
} from "../../netlify/functions/lib/auth";

// These tests exercise the documented defaults (ADMIN_ID/ADMIN_PASSWORD are
// not set in the test environment).
const DEFAULT_ID = "admin";
const DEFAULT_PASSWORD = "gonit-ishkul";

describe("admin credentials", () => {
  it("accepts the documented default pair", () => {
    expect(checkCredentials(DEFAULT_ID, DEFAULT_PASSWORD)).toBe(true);
  });

  it("rejects wrong id, wrong password, and empty input", () => {
    expect(checkCredentials("admin", "wrong")).toBe(false);
    expect(checkCredentials("root", DEFAULT_PASSWORD)).toBe(false);
    expect(checkCredentials("", "")).toBe(false);
    expect(checkCredentials(DEFAULT_ID, "")).toBe(false);
  });
});

describe("admin session tokens", () => {
  it("signs a token that verifies, with the documented lifetime", () => {
    const now = Date.parse("2026-10-19T10:00:00.000Z");
    const { token, expiresAt } = signToken(now);
    expect(expiresAt).toBe(now + TOKEN_TTL_MS);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifyToken(token, now + 60_000)).toBe(true);
  });

  it("expires exactly at its deadline", () => {
    const now = Date.parse("2026-10-19T10:00:00.000Z");
    const { token, expiresAt } = signToken(now);
    expect(verifyToken(token, expiresAt - 1)).toBe(true);
    expect(verifyToken(token, expiresAt)).toBe(false);
    expect(verifyToken(token, expiresAt + 1)).toBe(false);
  });

  it("rejects tampered, truncated, and absent tokens", () => {
    const now = Date.parse("2026-10-19T10:00:00.000Z");
    const { token } = signToken(now);
    const [payload, signature] = token.split(".");

    expect(verifyToken(null, now)).toBe(false);
    expect(verifyToken(undefined, now)).toBe(false);
    expect(verifyToken("", now)).toBe(false);
    expect(verifyToken("not-a-token", now)).toBe(false);
    expect(verifyToken(payload, now)).toBe(false); // signature missing
    expect(verifyToken(`${payload}.${signature.slice(0, -1)}`, now)).toBe(false); // signature cropped

    // Same shape, different payload (extended expiry) → old signature fails.
    const forged = Buffer.from(JSON.stringify({ sub: "admin", exp: now + 86_400_000 })).toString("base64url");
    expect(verifyToken(`${forged}.${signature}`, now)).toBe(false);
  });

  it("does not verify a token signed with a different secret", () => {
    const now = Date.now();
    const { token } = signToken(now);
    const [payload] = token.split(".");
    const other = createHmac("sha256", "someone-elses-key").update(payload).digest("base64url");
    expect(verifyToken(`${payload}.${other}`, now)).toBe(false);
  });
});

describe("bearer header parsing", () => {
  it("extracts the token and tolerates spacing/casing", () => {
    expect(bearer("Bearer abc.def")).toBe("abc.def");
    expect(bearer("bearer   abc.def")).toBe("abc.def");
    expect(bearer("  Bearer abc.def  ")).toBe("abc.def");
  });

  it("returns null for missing or non-bearer values", () => {
    expect(bearer(undefined)).toBeNull();
    expect(bearer(null)).toBeNull();
    expect(bearer("")).toBeNull();
    expect(bearer("abc.def")).toBeNull();
    expect(bearer("Basic dXNlcjpwdw==")).toBeNull();
  });
});
