import type { Problem } from "./types";
import partA from "./problems-a.json";
import partB from "./problems-b.json";
import partC from "./problems-c.json";

/**
 * The bundled problem bank. The three JSON shards are authored separately
 * (by topic) and merged here so the app stays fully functional even when the
 * Supabase-backed API is unreachable — the archive simply falls back to this.
 */
export const PROBLEMS: Problem[] = [...partA, ...partB, ...partC] as Problem[];

const byId = new Map<string, Problem>();
for (const p of PROBLEMS) byId.set(p.id, p);

export function getProblem(id: string): Problem | undefined {
  return byId.get(id);
}

export { type Problem } from "./types";
export {
  TOPICS,
  CATEGORIES,
  DIFFICULTIES,
  TYPES,
  type ProblemType,
  type ProblemTopic,
  type ProblemCategory,
  type ProblemDifficulty
} from "./types";
