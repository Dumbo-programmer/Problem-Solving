#!/usr/bin/env node
/**
 * Merges the per-topic problem shards into a single `dist/data/problems.json`
 * that the Netlify Function seeds into Supabase on first boot.
 *
 * Also runs a full integrity check, so a malformed problem fails the build
 * instead of silently shipping.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "src", "data");

const TOPICS = new Set(["NUMBER_THEORY", "ALGEBRA", "GEOMETRY", "COMBINATORICS", "INEQUALITY", "PROBABILITY"]);
const TYPES = new Set(["OLYMPIAD", "ACADEMICS"]);
const CATEGORIES = new Set(["PRIMARY", "JUNIOR", "SECONDARY", "HIGHER_SECONDARY"]);
const DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD", "OLYMPIAD"]);
const ANSWER_RE = /^-?\d+(\.\d+)?(\/-?\d+)?$/;

const files = readdirSync(dataDir)
  .filter((f) => /^problems-[a-z]\.json$/.test(f))
  .sort();

if (files.length === 0) {
  console.error("✗ no problem shards found in src/data/");
  process.exit(1);
}

const problems = [];
const errors = [];
const seenIds = new Set();
const seenSlugs = new Set();

for (const file of files) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(join(dataDir, file), "utf8"));
  } catch (err) {
    errors.push(`${file}: invalid JSON — ${err.message}`);
    continue;
  }
  if (!Array.isArray(parsed)) {
    errors.push(`${file}: expected a JSON array`);
    continue;
  }
  for (const [i, p] of parsed.entries()) {
    const where = `${file}[${i}]`;
    const need = ["id", "slug", "type", "topic", "category", "difficulty", "answer", "source"];
    for (const key of need) if (!p?.[key]) errors.push(`${where}: missing "${key}"`);
    for (const key of ["title", "statement", "solution"]) {
      if (!p?.[key] || typeof p[key].en !== "string" || !p[key].en.trim()) errors.push(`${where}: ${key}.en missing`);
      if (!p?.[key] || typeof p[key].bn !== "string" || !p[key].bn.trim()) errors.push(`${where}: ${key}.bn missing`);
    }
    if (p?.type && !TYPES.has(p.type)) errors.push(`${where}: bad type "${p.type}"`);
    if (p?.topic && !TOPICS.has(p.topic)) errors.push(`${where}: bad topic "${p.topic}"`);
    if (p?.category && !CATEGORIES.has(p.category)) errors.push(`${where}: bad category "${p.category}"`);
    if (p?.difficulty && !DIFFICULTIES.has(p.difficulty)) errors.push(`${where}: bad difficulty "${p.difficulty}"`);
    if (p?.answer && !ANSWER_RE.test(String(p.answer))) errors.push(`${where}: answer "${p.answer}" is not numeric`);
    if (p?.id && seenIds.has(p.id)) errors.push(`${where}: duplicate id "${p.id}"`);
    if (p?.slug && seenSlugs.has(p.slug)) errors.push(`${where}: duplicate slug "${p.slug}"`);
    if (p?.id) seenIds.add(p.id);
    if (p?.slug) seenSlugs.add(p.slug);
    problems.push(p);
  }
}

if (errors.length) {
  console.error(`✗ problem bank failed validation (${errors.length} issue${errors.length === 1 ? "" : "s"}):`);
  for (const e of errors.slice(0, 40)) console.error(`  • ${e}`);
  if (errors.length > 40) console.error(`  … and ${errors.length - 40} more`);
  process.exit(1);
}

// Stable ordering so the seeded database matches the bundled bank.
problems.sort((a, b) => (a.topic === b.topic ? a.id.localeCompare(b.id) : a.topic.localeCompare(b.topic)));

const outDir = join(root, "dist", "data");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "problems.json"), JSON.stringify(problems, null, 1));

const tally = (key) =>
  problems.reduce((acc, p) => {
    acc[p[key]] = (acc[p[key]] ?? 0) + 1;
    return acc;
  }, {});

console.log(`✓ merged ${problems.length} problems from ${files.length} shard(s) → dist/data/problems.json`);
console.log(`  topics:      ${JSON.stringify(tally("topic"))}`);
console.log(`  difficulties:${JSON.stringify(tally("difficulty"))}`);
console.log(`  categories:  ${JSON.stringify(tally("category"))}`);
console.log(`  types:       ${JSON.stringify(tally("type"))}`);
