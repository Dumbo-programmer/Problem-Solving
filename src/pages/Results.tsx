import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowRight, Check, Clock, Home, Minus, Trophy, X } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { getProblem, PROBLEMS } from "../data";
import MathText from "../components/MathText";
import { DifficultyBadge, TopicBadge } from "../components/Badges";
import { fetchStandings } from "../lib/api";
import { getClientId, readLocalTests } from "../lib/storage";
import type { PracticeTest, Problem, StandingsRow } from "../lib/types";

/** Letter-grade banding so the score reads at a glance. */
function band(pct: number): { label: string; className: string } {
  if (pct >= 90) return { label: "A+", className: "text-emerald-500" };
  if (pct >= 80) return { label: "A", className: "text-emerald-500" };
  if (pct >= 70) return { label: "B+", className: "text-sky-500" };
  if (pct >= 60) return { label: "B", className: "text-sky-500" };
  if (pct >= 50) return { label: "C", className: "text-amber-500" };
  if (pct >= 40) return { label: "D", className: "text-amber-500" };
  return { label: "F", className: "text-rose-500" };
}

export default function Results() {
  const { id = "" } = useParams();
  const { t, L } = useI18n();
  const location = useLocation();

  const [test, setTest] = useState<PracticeTest | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const found = readLocalTests().find((x) => x.id === id) ?? null;
    setTest(found);
    if (found) {
      const resolved = found.problemIds
        .map((pid) => getProblem(pid) ?? PROBLEMS.find((p) => p.id === pid))
        .filter((p): p is Problem => Boolean(p));
      setProblems(resolved);
      // Open every incorrect answer by default — that's what people came to see.
      setOpenIds(new Set(found.answers.filter((a) => !a.correct).map((a) => a.problemId)));
    }
  }, [id]);

  const stats = useMemo(() => {
    if (!test) return null;
    const total = test.maxScore || test.answers.length || 1;
    const correct = test.answers.filter((a) => a.correct).length;
    const wrong = test.answers.filter((a) => !a.correct && a.given.trim()).length;
    const skipped = test.answers.filter((a) => !a.given.trim()).length;
    const pct = Math.round((correct / total) * 100);
    const mins = test.submittedAt ? (Date.parse(test.submittedAt) - Date.parse(test.startedAt)) / 60000 : 0;
    return { total, correct, wrong, skipped, pct, mins };
  }, [test]);

  if (!test || !stats) {
    return (
      <div className="shell flex flex-col items-center gap-4 py-28 text-center">
        <h1 className="text-xl font-bold text-ink-900">{t("runner.notFound")}</h1>
        <p className="max-w-sm text-sm text-neutral-500">{t("runner.notFoundHint")}</p>
        <Link to="/practice" className="btn-primary">
          {t("cta.takeTest")}
        </Link>
      </div>
    );
  }

  const grade = band(stats.pct);
  const showSaved = (location.state as { saved?: boolean } | null)?.saved;

  return (
    <div className="shell max-w-3xl py-10 lg:py-14">
      {/* ---- scorecard ---- */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-lift sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent-400/20 blur-3xl" />
        <div className="relative">
          <p className="eyebrow">{t("result.title")}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink-900">{test.title}</h1>
          {showSaved && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <Check size={13} /> {t("result.saveNotice")}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-5">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-5xl font-extrabold leading-none text-ink-900">
                  {stats.pct}
                </span>
                <span className="font-mono text-xl font-bold text-slate-400">%</span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                {t("result.score")}
              </p>
            </div>

            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 ${grade.className}`}>
              <span className="font-mono text-xl font-extrabold">{grade.label}</span>
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <Metric icon={Check} tone="text-emerald-500" label={t("result.correct")} value={`${stats.correct}/${stats.total}`} />
              <Metric icon={X} tone="text-rose-500" label={t("result.incorrect")} value={String(stats.wrong)} />
              <Metric icon={Clock} tone="text-slate-400" label={t("result.timeTaken")} value={`${stats.mins.toFixed(1)} ${t("builder.minutesShort")}`} />
              {stats.skipped > 0 && (
                <Metric icon={Minus} tone="text-slate-400" label={t("result.skipped")} value={String(stats.skipped)} />
              )}
            </div>
          </div>

          {test.timedOut && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-lg bg-amber-500/12 px-3 py-2 text-xs font-semibold text-amber-700">
              <Clock size={13} /> {t("runner.autoSubmitNotice")}
            </p>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/practice" className="btn-primary">
              {t("result.newTest")} <ArrowRight size={16} />
            </Link>
            <Link to="/past-tests" className="btn-ghost">
              {t("result.backToPast")}
            </Link>
            <Link to="/" className="btn-quiet">
              <Home size={15} /> {t("nav.home")}
            </Link>
          </div>
        </div>
      </div>

      {/* ---- contest standing (scheduled attempts only) ---- */}
      {test.scheduledTestId && <ScheduledRank testId={test.scheduledTestId} entryId={test.id} />}

      {/* ---- per-problem review ---- */}
      <h2 className="mt-10 text-lg font-bold text-ink-900">{t("result.review")}</h2>
      <div className="mt-4 space-y-3">
        {problems.map((p, i) => {
          const answer = test.answers.find((a) => a.problemId === p.id);
          const correct = answer?.correct ?? false;
          const skipped = !answer?.given.trim();
          const open = openIds.has(p.id);
          return (
            <article
              key={p.id}
              className={`card overflow-hidden border-l-4 ${
                correct
                  ? "border-l-emerald-500"
                  : skipped
                    ? "border-l-slate-300"
                    : "border-l-rose-500"
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(p.id)) next.delete(p.id);
                    else next.add(p.id);
                    return next;
                  })
                }
                className="flex w-full items-start gap-3 px-5 py-4 text-left"
                aria-expanded={open}
              >
                <span className="mt-0.5 font-mono text-xs font-semibold text-slate-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-snug text-ink-900">
                    {L(p.title)}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    <TopicBadge value={p.topic} />
                    <DifficultyBadge value={p.difficulty} />
                    <span
                      className={`chip border ${
                        correct
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                          : skipped
                            ? "border-slate-200 bg-slate-50 text-slate-500"
                            : "border-rose-500/40 bg-rose-500/10 text-rose-700"
                      }`}
                    >
                      {correct ? t("result.correct") : skipped ? t("result.skipped") : t("result.incorrect")}
                    </span>
                  </span>
                </span>
              </button>

              {open && (
                <div className="animate-slideUp border-t border-slate-200/80 px-5 pb-5 pt-4">
                  <div className="text-[15px] leading-relaxed text-slate-700">
                    <MathText block>{L(p.statement)}</MathText>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <AnswerBox
                      label={t("result.yourAnswer")}
                      value={answer?.given || "—"}
                      tone={correct ? "ok" : "bad"}
                    />
                    <AnswerBox label={t("result.correctAnswer")} value={p.answer} tone="ok" />
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("result.explanation")}
                    </p>
                    <div className="mt-2 text-sm leading-relaxed text-slate-700">
                      <MathText block>{L(p.solution)}</MathText>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof Check;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Icon size={15} className={tone} />
        <span className="font-mono text-lg font-bold text-ink-900">{value}</span>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function AnswerBox({ label, value, tone }: { label: string; value: string; tone: "ok" | "bad" }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        tone === "ok"
          ? "border-emerald-500/40 bg-emerald-500/8"
          : "border-rose-500/40 bg-rose-500/8"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-base font-bold text-ink-900">{value}</p>
    </div>
  );
}

/**
 * Where this attempt landed on the contest's standings board — shown only for
 * scheduled (weekly/monthly) attempts, with a link through to the full table.
 */
function ScheduledRank({ testId, entryId }: { testId: string; entryId: string }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<StandingsRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchStandings(testId).then((res) => {
      if (!cancelled) setRows(res.rows);
    });
    return () => {
      cancelled = true;
    };
  }, [testId]);

  if (rows === null) return null;
  const row = rows.find((r) => r.entryId === entryId) ?? rows.find((r) => r.clientId === getClientId());
  if (!row) return null;

  return (
    <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 border-accent-500/30 bg-accent-500/5 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/15 text-accent-500">
          <Trophy size={19} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t("results.rank")}
          </p>
          <p className="font-mono text-xl font-extrabold text-ink-900">
            {t("results.rankOf", { rank: row.rank, total: rows.length })}
          </p>
        </div>
      </div>
      <Link to={`/tests?standings=${encodeURIComponent(testId)}`} className="btn-ghost h-9 px-3.5 text-xs">
        {t("results.standings")} <ArrowRight size={14} />
      </Link>
    </div>
  );
}
