import type { ProblemCategory, ProblemDifficulty, ProblemTopic, ProblemType } from "../lib/types";
import { CATEGORY_LABELS, DIFFICULTY_LABELS, TOPIC_LABELS, TYPE_LABELS, useI18n } from "../lib/i18n";

/**
 * Visual vocabulary shared by the archive, the builder and the results review.
 * Difficulty drives the colour so a paper's "shape" is readable at a glance.
 */

const DIFFICULTY_STYLES: Record<ProblemDifficulty, string> = {
  EASY: "border-emerald-500/40 bg-emerald-500/12 text-emerald-700",
  MEDIUM: "border-sky-500/40 bg-sky-500/12 text-sky-700",
  HARD: "border-violet-500/40 bg-violet-500/12 text-violet-700",
  OLYMPIAD: "border-accent-500/50 bg-accent-500/14 text-accent-700"
};

const TOPIC_DOT: Record<ProblemTopic, string> = {
  NUMBER_THEORY: "bg-emerald-500",
  ALGEBRA: "bg-sky-500",
  GEOMETRY: "bg-violet-500",
  COMBINATORICS: "bg-accent-500",
  INEQUALITY: "bg-rose-500",
  PROBABILITY: "bg-teal-500"
};

export function DifficultyBadge({ value, size = "sm" }: { value: ProblemDifficulty; size?: "sm" | "md" }) {
  const { L } = useI18n();
  return (
    <span
      className={`chip border ${DIFFICULTY_STYLES[value]} ${size === "md" ? "px-3 py-1.5 text-sm" : ""}`}
    >
      {L(DIFFICULTY_LABELS[value])}
    </span>
  );
}

export function TopicBadge({ value, size = "sm" }: { value: ProblemTopic; size?: "sm" | "md" }) {
  const { L } = useI18n();
  return (
    <span
      className={`chip border border-slate-200 bg-white text-slate-700 ${
        size === "md" ? "px-3 py-1.5 text-sm" : ""
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${TOPIC_DOT[value]}`} aria-hidden />
      {L(TOPIC_LABELS[value])}
    </span>
  );
}

export function CategoryBadge({ value }: { value: ProblemCategory }) {
  const { L } = useI18n();
  return (
    <span className="chip border border-slate-200 bg-slate-50 text-slate-600">
      {L(CATEGORY_LABELS[value])}
    </span>
  );
}

export function TypeBadge({ value }: { value: ProblemType }) {
  const { L } = useI18n();
  const olympiad = value === "OLYMPIAD";
  return (
    <span
      className={`chip border ${
        olympiad
          ? "border-accent-500/50 bg-accent-500/10 text-accent-700"
          : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      {L(TYPE_LABELS[value])}
    </span>
  );
}

export { TOPIC_DOT };
