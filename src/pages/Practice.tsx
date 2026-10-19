import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Dices, Shuffle, Timer } from "lucide-react";
import { TOPIC_LABELS, useI18n } from "../lib/i18n";
import { useProblemBank } from "../lib/useProblems";
import { filterProblems, pickProblems } from "../lib/filters";
import FilterPanel, { EMPTY_FACETS, facetsToFilters, type FacetState } from "../components/FilterPanel";
import MathText from "../components/MathText";
import PageDecor from "../components/PageDecor";
import { DifficultyBadge, TopicBadge } from "../components/Badges";
import { newTestId } from "../lib/storage";
import type { PracticeTest, Problem } from "../lib/types";

const DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90];
const COUNT_PRESETS = [5, 10, 15, 20];

/**
 * The practice-test builder.
 *
 * Step 1  filter the bank (Type / Topic / Category / Difficulty)
 * Step 2  auto-pick a balanced sample, or hand-pick individual problems
 * Step 3  set the clock, then start — the test is graded the moment it ends.
 */
export default function Practice() {
  const { t, L } = useI18n();
  const navigate = useNavigate();

  const [facets, setFacets] = useState<FacetState>(EMPTY_FACETS);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [count, setCount] = useState(10);
  const [duration, setDuration] = useState(20);
  const [seed, setSeed] = useState(() => Date.now());
  const [manualIds, setManualIds] = useState<string[]>([]);

  const { problems: filtered, loading, counts } = useProblemBank(facetsToFilters(facets));
  const pool = useMemo(
    () => filterProblems(filtered, { ...facetsToFilters(facets), search: facets.search }),
    [filtered, facets]
  );

  const autoPick = useMemo(() => pickProblems(pool, Math.min(count, pool.length), seed), [pool, count, seed]);
  const chosen: Problem[] = useMemo(
    () => (mode === "auto" ? autoPick : pool.filter((p) => manualIds.includes(p.id))),
    [mode, autoPick, pool, manualIds]
  );

  const toggleManual = (id: string) =>
    setManualIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const canStart = chosen.length > 0 && duration > 0;

  const start = () => {
    if (!canStart) return;
    const id = newTestId();
    const test: PracticeTest = {
      id,
      clientId: "",
      title: buildTitle(chosen, t, L),
      filters: {
        types: facets.types,
        topics: facets.topics,
        categories: facets.categories,
        difficulties: facets.difficulties
      },
      problemIds: chosen.map((p) => p.id),
      durationMin: duration,
      status: "IN_PROGRESS",
      answers: [],
      score: 0,
      maxScore: chosen.length,
      correctCount: 0,
      startedAt: new Date().toISOString(),
      origin: "local"
    };
    sessionStorage.setItem(`test:${id}`, JSON.stringify(test));
    navigate(`/test/${id}`);
  };

  const perProblem = chosen.length ? (duration / chosen.length).toFixed(1) : "0";

  return (
    <div className="relative">
      <PageDecor seed={7} />
      <div className="shell py-10 lg:py-14">
      <header className="max-w-2xl">
        <p className="eyebrow">{t("nav.practice")}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-4xl">
          {t("builder.title")}
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{t("builder.lede")}</p>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        {/* ------------- left: configuration ------------- */}
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="text-sm font-bold text-ink-900 dark:text-white">{t("builder.step1")}</h2>
            <div className="mt-4">
              <FilterPanel value={facets} onChange={setFacets} counts={counts} />
            </div>
          </section>

          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-ink-900 dark:text-white">{t("builder.step2")}</h2>
              <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-ink-700">
                {(["auto", "manual"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      mode === m
                        ? "bg-accent-500 text-white"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    {m === "auto" ? t("builder.autoPick") : t("builder.manualPick")}
                  </button>
                ))}
              </div>
            </div>

            {mode === "auto" ? (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t("builder.count")}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {COUNT_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCount(c)}
                          className={`h-8 w-8 rounded-lg font-mono text-xs font-semibold transition-colors ${
                            count === c
                              ? "bg-accent-500 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-ink-800 dark:text-slate-300 dark:hover:bg-ink-700"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSeed(Date.now())}
                    className="btn-quiet h-8 px-3 text-xs"
                    title={t("builder.randomSeed")}
                  >
                    <Shuffle size={14} /> {t("builder.randomSeed")}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {t("builder.pool")}: <span className="font-mono">{pool.length}</span> ·{" "}
                  {t("builder.selected")}: <span className="font-mono">{autoPick.length}</span>
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  {t("builder.selected")}: <span className="font-mono">{chosen.length}</span>
                </p>
                <div className="mt-3 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                  {pool.length === 0 && !loading && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t("filter.none")}</p>
                  )}
                  {pool.map((p) => {
                    const on = manualIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleManual(p.id)}
                        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                          on
                            ? "border-accent-500/60 bg-accent-500/8"
                            : "border-slate-200 hover:border-slate-300 dark:border-ink-700 dark:hover:border-ink-600"
                        }`}
                        aria-pressed={on}
                      >
                        <span
                          className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border ${
                            on
                              ? "border-accent-500 bg-accent-500 text-white"
                              : "border-slate-300 dark:border-ink-600"
                          }`}
                        >
                          {on && <Check size={12} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink-900 dark:text-white">
                            {L(p.title)}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            <TopicBadge value={p.topic} />
                            <DifficultyBadge value={p.difficulty} />
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-bold text-ink-900 dark:text-white">{t("builder.step3")}</h2>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {DURATION_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`toggle-chip ${duration === d ? "toggle-chip-on" : "toggle-chip-off"}`}
                >
                  <Timer size={13} /> {d} {t("builder.minutesShort")}
                </button>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={duration}
                  onChange={(e) => setDuration(Math.max(1, Math.min(240, Number(e.target.value) || 1)))}
                  className="field no-spin w-20 px-2.5 py-1.5 text-center text-sm"
                  aria-label={t("builder.duration")}
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">{t("builder.minutes")}</span>
              </div>
            </div>
            {chosen.length > 0 && (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {t("builder.perProblem", { n: perProblem })}
              </p>
            )}
          </section>
        </div>

        {/* ------------- right: live summary ------------- */}
        <aside className="lg:sticky lg:top-20">
          <div className="card p-5">
            <h2 className="text-sm font-bold text-ink-900 dark:text-white">{t("builder.ready")}</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat label={t("past.questions")} value={chosen.length} />
              <Stat label={t("builder.duration")} value={`${duration} ${t("builder.minutesShort")}`} />
            </div>

            <div className="mt-4 max-h-[18rem] space-y-1.5 overflow-y-auto pr-1">
              {chosen.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("builder.needProblems")}</p>
              ) : (
                chosen.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs dark:bg-ink-900/70"
                  >
                    <span className="font-mono font-semibold text-slate-400">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <MathText className="line-clamp-2 text-slate-700 dark:text-slate-300">
                        {L(p.statement)}
                      </MathText>
                    </span>
                  </div>
                ))
              )}
            </div>

            <button type="button" onClick={start} disabled={!canStart} className="btn-primary mt-5 w-full py-3">
              {t("action.start")} <ChevronRight size={16} />
            </button>
            {!canStart && (
              <p className="mt-2 text-center text-xs text-rose-500">
                {chosen.length === 0 ? t("builder.needProblems") : t("builder.needTime")}
              </p>
            )}
          </div>

          <div className="card mt-4 flex items-start gap-3 p-4">
            <Dices size={18} className="mt-0.5 shrink-0 text-accent-500" />
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {t("home.how2d")}
            </p>
          </div>
        </aside>
      </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-ink-900/70">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-bold text-ink-900 dark:text-white">{value}</div>
    </div>
  );
}

/** Derive a friendly title from the paper's actual contents. */
function buildTitle(
  chosen: Problem[],
  t: (k: string) => string,
  L: (v: { en: string; bn: string }) => string
): string {
  if (chosen.length === 0) return t("builder.title");
  const topics = [...new Set(chosen.map((p) => p.topic))];
  const topicText = topics.map((tp) => L(TOPIC_LABELS[tp])).join(" + ");
  return `${topicText} · ${chosen.length}`;
}
