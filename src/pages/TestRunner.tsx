import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Flag, Loader2 } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { getProblem, PROBLEMS } from "../data";
import MathText from "../components/MathText";
import { DifficultyBadge, TopicBadge } from "../components/Badges";
import { gradeAnswer } from "../lib/grading";
import { saveTest } from "../lib/api";
import { readLocalTests, upsertLocalTest } from "../lib/storage";
import type { PracticeTest, Problem, TestAnswer } from "../lib/types";

/** Remaining milliseconds, refreshed every 250ms so the clock feels live. */
function useCountdown(endsAt: number | null, onExpire: () => void) {
  const [remaining, setRemaining] = useState<number>(endsAt ? Math.max(0, endsAt - Date.now()) : 0);
  const fired = useRef(false);

  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const left = Math.max(0, endsAt - Date.now());
      setRemaining(left);
      if (left <= 0 && !fired.current) {
        fired.current = true;
        onExpire();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt, onExpire]);

  return remaining;
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TestRunner() {
  const { id = "" } = useParams();
  const { t, L } = useI18n();
  const navigate = useNavigate();

  const [test, setTest] = useState<PracticeTest | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [missing, setMissing] = useState(false);
  const endsAtRef = useRef<number | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);

  // ---- load the paper (fresh from the builder, or resume from storage) ----
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      let loaded: PracticeTest | null = null;
      const fresh = sessionStorage.getItem(`test:${id}`);
      if (fresh) {
        try {
          loaded = JSON.parse(fresh) as PracticeTest;
        } catch {
          loaded = null;
        }
      }
      if (!loaded) {
        const stored = readLocalTests().find((x) => x.id === id);
        if (stored) loaded = stored;
      }
      if (cancelled) return;
      if (!loaded) {
        setMissing(true);
        return;
      }
      const resolved = loaded.problemIds
        .map((pid) => getProblem(pid) ?? PROBLEMS.find((p) => p.id === pid))
        .filter((p): p is Problem => Boolean(p));

      if (resolved.length === 0) {
        setMissing(true);
        return;
      }
      const started = Date.parse(loaded.startedAt);
      const candidate = started + loaded.durationMin * 60_000;
      const at = Number.isFinite(candidate) && candidate > Date.now() ? candidate : Date.now() + loaded.durationMin * 60_000;

      setTest(loaded);
      setProblems(resolved);
      setAnswers(
        Object.fromEntries((loaded.answers ?? []).filter((a) => a.given).map((a) => [a.problemId, a.given]))
      );
      endsAtRef.current = at;
      setEndsAt(at);
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // ---- grading + persistence ----
  const submit = useCallback(
    async (timedOut: boolean, currentTest: PracticeTest | null, currentProblems: Problem[], currentAnswers: Record<string, string>) => {
      if (!currentTest) return;
      setSubmitting(true);

      const graded: TestAnswer[] = currentProblems.map((p) => {
        const given = (currentAnswers[p.id] ?? "").trim();
        const res = gradeAnswer(given, p.answer);
        return {
          problemId: p.id,
          given,
          correct: res.correct,
          expected: p.answer,
          points: res.correct ? 1 : 0
        };
      });

      const correctCount = graded.filter((a) => a.correct).length;
      const finished: PracticeTest = {
        ...currentTest,
        status: "SUBMITTED",
        answers: graded,
        correctCount,
        score: correctCount,
        maxScore: currentProblems.length,
        submittedAt: new Date().toISOString(),
        timedOut
      };

      upsertLocalTest(finished);
      await saveTest(finished);
      sessionStorage.removeItem(`test:${id}`);
      navigate(`/test/${id}/results`, { state: { saved: true } });
    },
    [id, navigate]
  );

  const remaining = useCountdown(endsAt, () => {
    void submit(true, test, problems, answers);
  });

  const answeredCount = useMemo(
    () => problems.filter((p) => (answers[p.id] ?? "").trim().length > 0).length,
    [problems, answers]
  );

  // ---- guards / loading states ----
  if (missing) {
    return (
      <div className="shell flex flex-col items-center gap-4 py-28 text-center">
        <AlertTriangle size={30} className="text-amber-500" />
        <div>
          <h1 className="text-xl font-bold text-ink-900">{t("runner.notFound")}</h1>
          <p className="mt-2 text-sm text-slate-500">{t("runner.notFoundHint")}</p>
        </div>
        <Link to="/practice" className="btn-primary">
          {t("cta.takeTest")}
        </Link>
      </div>
    );
  }

  if (!test || problems.length === 0) {
    return (
      <div className="shell flex items-center justify-center py-28">
        <Loader2 size={26} className="animate-spin text-accent-500" />
      </div>
    );
  }

  if (submitting) {
    return (
      <div className="shell flex flex-col items-center gap-3 py-28 text-center">
        <Loader2 size={26} className="animate-spin text-accent-500" />
        <p className="text-sm text-slate-500">{t("misc.loading")}</p>
      </div>
    );
  }

  const problem = problems[current];
  const pct = Math.round((answeredCount / problems.length) * 100);
  const lowTime = remaining < 60_000;
  const isLast = current === problems.length - 1;

  const setAnswer = (problemId: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [problemId]: value }));

  const confirmSubmit = () => {
    const unanswered = problems.length - answeredCount;
    const msg =
      unanswered > 0
        ? `${t("runner.confirmSubmit")} (${unanswered} ${t("runner.unanswered")})`
        : t("runner.confirmSubmit");
    if (window.confirm(msg)) void submit(false, test, problems, answers);
  };

  return (
    <div className="shell max-w-3xl py-8 lg:py-10">
      {/* ---- sticky header: clock + progress ---- */}
      <div className="sticky top-16 z-20 -mx-4 mb-6 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">{test.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {t("runner.question")} {current + 1} {t("runner.of")} {problems.length} · {answeredCount}{" "}
              {t("runner.answered")}
            </p>
          </div>
          <div
            className={`flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-lg font-bold tabular-nums ${
              lowTime
                ? "bg-rose-500/12 text-rose-600"
                : "bg-slate-100 text-ink-900"
            }`}
            role="timer"
            aria-live={lowTime ? "polite" : "off"}
          >
            {fmt(remaining)}
          </div>
        </div>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-400 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ---- the problem ---- */}
      <article className="card p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <span className="font-mono text-sm font-bold text-slate-400">
            {String(current + 1).padStart(2, "0")}
          </span>
          <div className="flex flex-wrap justify-end gap-1.5">
            <TopicBadge value={problem.topic} />
            <DifficultyBadge value={problem.difficulty} />
          </div>
        </div>

        <h2 className="mt-3 text-lg font-bold text-ink-900">{L(problem.title)}</h2>

        <div className="mt-3 text-[16px] leading-relaxed text-slate-700">
          <MathText block>{L(problem.statement)}</MathText>
        </div>

        <div className="mt-6 border-t border-dashed border-slate-200 pt-5">
          <label
            htmlFor={`ans-${problem.id}`}
            className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            {t("result.yourAnswer")}
          </label>
          <input
            id={`ans-${problem.id}`}
            value={answers[problem.id] ?? ""}
            onChange={(e) => setAnswer(problem.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isLast) setCurrent((c) => Math.min(problems.length - 1, c + 1));
            }}
            placeholder={t("runner.answerPlaceholder")}
            className="field max-w-md font-mono text-base"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-2 text-xs text-slate-400">
            {problem.answer.includes("/") ? t("runner.answerKindFraction") : t("runner.answerKindNumber")} ·{" "}
            {problem.source}
          </p>
        </div>
      </article>

      {/* ---- navigation ---- */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="btn-ghost"
        >
          <ChevronLeft size={16} /> {t("action.prev")}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={confirmSubmit} className="btn-ghost">
            <Flag size={15} /> {t("action.submit")}
          </button>
          {!isLast ? (
            <button
              type="button"
              onClick={() => setCurrent((c) => Math.min(problems.length - 1, c + 1))}
              className="btn-primary"
            >
              {t("action.next")} <ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={confirmSubmit} className="btn-primary">
              <Check size={16} /> {t("action.submit")}
            </button>
          )}
        </div>
      </div>

      {/* ---- question grid ---- */}
      <div className="card mt-5 p-4">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t("runner.progress")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {problems.map((p, i) => {
            const filled = (answers[p.id] ?? "").trim().length > 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setCurrent(i)}
                aria-label={`${t("runner.question")} ${i + 1}`}
                className={`h-8 w-8 rounded-lg font-mono text-xs font-semibold transition-colors ${
                  i === current
                    ? "bg-accent-500 text-white ring-2 ring-accent-300"
                    : filled
                      ? "bg-emerald-500/15 text-emerald-700"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
