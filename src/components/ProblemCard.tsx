import { useState } from "react";
import { Check, ChevronDown, Lightbulb, X } from "lucide-react";
import type { Problem } from "../lib/types";
import { useI18n } from "../lib/i18n";
import { gradeAnswer } from "../lib/grading";
import MathText from "./MathText";
import { CategoryBadge, DifficultyBadge, TopicBadge, TypeBadge } from "./Badges";

/**
 * A single problem in the archive. Collapsed by default so the list stays
 * scannable; expanding reveals the statement, a "try it now" box that grades
 * instantly, and — after a correct answer — the worked solution.
 */
export default function ProblemCard({
  problem,
  index,
  action
}: {
  problem: Problem;
  index?: number;
  action?: React.ReactNode;
}) {
  const { L, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [given, setGiven] = useState("");
  const [verdict, setVerdict] = useState<"correct" | "wrong" | null>(null);
  const [showSolution, setShowSolution] = useState(false);

  const check = () => {
    const res = gradeAnswer(given, problem.answer);
    setVerdict(res.correct ? "correct" : "wrong");
  };

  return (
    <article className="card overflow-hidden transition-shadow duration-200 hover:shadow-lift">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-4 text-left sm:px-5"
        aria-expanded={open}
      >
        {typeof index === "number" && (
          <span className="mt-0.5 font-mono text-xs font-semibold text-slate-400">
            {String(index).padStart(2, "0")}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug text-ink-900">
            {L(problem.title)}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <TopicBadge value={problem.topic} />
            <DifficultyBadge value={problem.difficulty} />
            <CategoryBadge value={problem.category} />
            <TypeBadge value={problem.type} />
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`mt-1 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="animate-slideUp border-t border-slate-200/80 px-4 pb-5 pt-4 sm:px-5">
          <div className="text-[15px] leading-relaxed text-slate-700">
            <MathText>{L(problem.statement)}</MathText>
          </div>

          <div className="mt-3 text-[11px] text-slate-400">
            {t("archive.from")}: {problem.source}
          </div>

          {/* Instant-check box */}
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-3">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("action.check")}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={given}
                onChange={(e) => {
                  setGiven(e.target.value);
                  setVerdict(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && check()}
                placeholder={t("runner.answerPlaceholder")}
                className="field max-w-[12rem] flex-1"
                aria-label={t("action.check")}
              />
              <button type="button" onClick={check} className="btn-primary h-10 px-4">
                {t("action.check")}
              </button>
              {verdict === "correct" && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/12 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
                  <Check size={14} /> {t("archive.correct")}
                </span>
              )}
              {verdict === "wrong" && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/12 px-2.5 py-1.5 text-xs font-semibold text-rose-700">
                  <X size={14} /> {t("archive.wrong")}
                </span>
              )}
            </div>

            {(verdict === "correct" || showSolution) && (
              <div className="mt-3 rounded-lg bg-slate-50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Lightbulb size={13} /> {t("result.explanation")}
                </div>
                <div className="mt-1.5 text-sm leading-relaxed text-slate-700">
                  <MathText block>{L(problem.solution)}</MathText>
                </div>
              </div>
            )}

            {!showSolution && verdict !== "correct" && (
              <button
                type="button"
                onClick={() => setShowSolution(true)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-600 hover:underline"
              >
                <Lightbulb size={13} /> {t("action.seeSolution")}
              </button>
            )}
          </div>

          {action && <div className="mt-4">{action}</div>}
        </div>
      )}
    </article>
  );
}
