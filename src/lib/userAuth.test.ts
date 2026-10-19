import { describe, expect, it } from "vitest";
import {
  MAX_PASSWORD,
  MIN_PASSWORD,
  SESSION_TTL_MS,
  hashPassword,
  normalizeEmail,
  normalizePhone,
  normalizeUsername,
  passwordOk,
  signSession,
  signToken,
  verifyPassword,
  verifySession,
  verifyToken
} from "../../netlify/functions/lib/auth";

describe("username rules", () => {
  it("lowercases and trims, then accepts 3–20 word characters", () => {
    expect(normalizeUsername("Rafi2026")).toBe("rafi2026");
    expect(normalizeUsername("  rafi_  ")).toBe("rafi_");
    expect(normalizeUsername("a_b_c")).toBe("a_b_c");
    expect(normalizeUsername("0123456789abcdefghij")).toBe("0123456789abcdefghij"); // 20
  });

  it("rejects too short/long, bad characters and non-strings", () => {
    expect(normalizeUsername("ab")).toBeNull();
    expect(normalizeUsername("a".repeat(21))).toBeNull();
    expect(normalizeUsername("raf i")).toBeNull();
    expect(normalizeUsername("rafi-2026")).toBeNull();
    expect(normalizeUsername("রফিক")).toBeNull(); // non-ASCII script
    expect(normalizeUsername("")).toBeNull();
    expect(normalizeUsername(undefined)).toBeNull();
    expect(normalizeUsername(42)).toBeNull();
  });
});

describe("email rules", () => {
  it("lowercases + trims, then accepts a normal address", () => {
    expect(normalizeEmail("Rafiq@Example.COM")).toBe("rafiq@example.com");
    expect(normalizeEmail("  a.b+tag@mail.co.uk  ")).toBe("a.b+tag@mail.co.uk");
  });

  it("rejects malformed addresses and non-strings", () => {
    expect(normalizeEmail("no-at-sign")).toBeNull();
    expect(normalizeEmail("missing@tld")).toBeNull();
    expect(normalizeEmail("spaces in@mail.com")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });
});

describe("phone rules", () => {
  it("keeps digits and a leading +, dropping spaces and dashes", () => {
    expect(normalizePhone("+880 1700-000000")).toBe("+8801700000000");
    expect(normalizePhone("01700000000")).toBe("01700000000");
    expect(normalizePhone("  +1 555 123 4567 ")).toBe("+15551234567");
  });

  it("rejects too short/long and non-strings", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("1".repeat(19))).toBeNull();
    expect(normalizePhone("not-a-number")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone(1700000000)).toBeNull();
  });
});

describe("password policy", () => {  it("accepts 6–72 characters", () => {
    expect(passwordOk("x".repeat(MIN_PASSWORD))).toBe(true);
    expect(passwordOk("x".repeat(MAX_PASSWORD))).toBe(true);
    expect(passwordOk("secret123")).toBe(true);
  });

  it("rejects short, long and non-string values", () => {
    expect(passwordOk("x".repeat(MIN_PASSWORD - 1))).toBe(false);
    expect(passwordOk("x".repeat(MAX_PASSWORD + 1))).toBe(false);
    expect(passwordOk("")).toBe(false);
    expect(passwordOk(123456)).toBe(false);
  });
});

describe("password hashing (scrypt)", () => {
  it("round-trips and stores salted, parameterised hashes", () => {
    const stored = hashPassword("hunter2!");
    expect(stored.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(stored).not.toContain("hunter2!");
    expect(verifyPassword("hunter2!", stored)).toBe(true);
  });

  it("salts every hash (same password, different rows)", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a).not.toBe(b);
    expect(verifyPassword("same-password", a)).toBe(true);
    expect(verifyPassword("same-password", b)).toBe(true);
  });

  it("rejects wrong passwords and tampered or garbage hashes", () => {
    const stored = hashPassword("correct-horse");
    expect(verifyPassword("correct-horse ", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);

    const [tag, n, r, p, salt, hash] = stored.split("$");
    // Flip a hex character in the digest.
    const flipped = (hash[0] === "0" ? "1" : "0") + hash.slice(1);
    expect(verifyPassword("correct-horse", [tag, n, r, p, salt, flipped].join("$"))).toBe(false);
    // Unknown algorithm / missing parts.
    expect(verifyPassword("correct-horse", "plaintext")).toBe(false);
    expect(verifyPassword("correct-horse", "bcrypt$1$2$3$a$b")).toBe(false);
    expect(verifyPassword("correct-horse", "scrypt$16384$8$1$onlythree")).toBe(false);
  });

  it("refuses absurd work parameters (crafted rows can't ask for a gigabyte)", () => {
    const [tag, , , , salt, hash] = hashPassword("pw").split("$");
    expect(verifyPassword("pw", [tag, String(1 << 22), "8", "1", salt, hash].join("$"))).toBe(false);
    expect(verifyPassword("pw", [tag, "16384", "0", "1", salt, hash].join("$"))).toBe(false);
    expect(verifyPassword("pw", [tag, "16384", "8", "99", salt, hash].join("$"))).toBe(false);
    expect(verifyPassword("pw", ["scrypt", "not-a-number", "8", "1", salt, hash].join("$"))).toBe(false);
  });
});

describe("learner sessions", () => {
  const NOW = Date.parse("2026-10-19T10:00:00.000Z");

  it("signs a 30-day session bound to the user id", () => {
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    const { token, expiresAt } = signSession("user-123", NOW);
    expect(expiresAt).toBe(NOW + SESSION_TTL_MS);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifySession(token, NOW + 60_000)).toBe("user-123");
  });

  it("expires exactly at its deadline", () => {
    const { token, expiresAt } = signSession("user-123", NOW);
    expect(verifySession(token, expiresAt - 1)).toBe("user-123");
    expect(verifySession(token, expiresAt)).toBeNull();
    expect(verifySession(token, expiresAt + 1)).toBeNull();
  });

  it("rejects tampered and absent tokens", () => {
    const { token } = signSession("user-123", NOW);
    const [payload, signature] = token.split(".");
    expect(verifySession(null, NOW)).toBeNull();
    expect(verifySession(undefined, NOW)).toBeNull();
    expect(verifySession("", NOW)).toBeNull();
    expect(verifySession("garbage", NOW)).toBeNull();
    expect(verifySession(payload, NOW)).toBeNull();
    expect(verifySession(`${payload}.${signature.slice(0, -1)}`, NOW)).toBeNull();

    // Re-point the payload at another user; the old signature fails.
    const forged = Buffer.from(
      JSON.stringify({ sub: "someone-else", kind: "learner", exp: NOW + 60_000 }),
      "utf8"
    ).toString("base64url");
    expect(verifySession(`${forged}.${signature}`, NOW)).toBeNull();
  });

  it("keeps the two token kinds apart — sessions never open admin routes", () => {
    const session = signSession("user-123", NOW);
    expect(verifyToken(session.token, NOW)).toBe(false); // learner ≠ admin

    const admin = signToken(NOW);
    expect(verifySession(admin.token, NOW)).toBeNull(); // admin ≠ learner
    expect(verifyToken(admin.token, NOW)).toBe(true);
  });
});
