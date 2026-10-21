/**
 * The documented zero-config staff credentials.
 *
 * The server keeps its own copy (`netlify/functions/lib/auth.ts`) because it
 * also hashes and compares them. A deployment that sets `ADMIN_ID` /
 * `ADMIN_PASSWORD` overrides both copies — the admin sign-in screen asks the
 * API whether the defaults are still in force and hides them when they aren't.
 */
export const DEFAULT_ADMIN_ID = "admin";
export const DEFAULT_ADMIN_PASSWORD = "gonit-ishkul";
