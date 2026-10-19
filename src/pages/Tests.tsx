import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CalendarDays, Clock, FlaskConical, Loader2, Play, Timer, Trophy, UserRound, Users } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import PageDecor from "../components/PageDecor";
import { fetchPastTests, fetchScheduledTests, fetchStandings } from "../lib/api";
import { countdownParts, phaseOf } from "../lib/scheduled";
import { formatDuration } from "../lib/leaderboard";
import {
  clearDraft,
  getClientId,
  newTestId,
  readDisplayName,
  readDrafts,
  writeDraft,
  writeDisplayName
} from "../lib/storage";
import type { PracticeTest, ScheduledTest, StandingsRow, TestPhase } from "../lib/types";

/**
 * The scheduled-test page: this week's paper, this month's challenge and the
 * papers that have closed. Each contest carries its own standings board, the
 * phase countdown, and the one-attempt start flow (display name → clock).
 */

/** A clock that ticks every second while the page is open. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function fmtCountdown(ms: number, dayUnit: string): string {
  const { d, h, m, s } = countdownParts(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return d > 0 ? `${d}${dayUnit} ${clock}` : clock;
}

const PHASE_CHIP: Record<TestPhase, string> = {
  live: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  upcoming: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  ended: "border-slate-400/40 bg-slate-400/10 text-slate-600 dark:text-slate-300"
};

/** One own attempt per paper: a submitted attempt always beats a draft. */
function reduceOwn(entries: PracticeTest[]): Map<string, PracticeTest> {
  const map = new Map<string, PracticeTest>();
  for (const e of entries) {
    if (!e.scheduledTestId) continue;
    const current = map.get(e.scheduledTestId);
    if (!current) {
      map.set(e.scheduledTestId, e);
      continue;
    }
    const a = e.status === "SUBMITTED";
    const b = current.status === "SUBMITTED";
    if (a && !b) map.set(e.scheduledTestId, e);
    else if (a === b && (e.submittedAt ?? "") >= (current.submittedAt ?? "")) map.set(e.scheduledTestId, e);
  }
  return map;
}

export default function Tests() {
  const { t, L, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const now = useNow();

  const [tests, setTests] = useState<ScheduledTest[] | null>(null);
  const [source, setSource] = useState<"cloud" | "local">("local");
  const [entries, setEntries] = useState<PracticeTest[]>([]);
  const [openStandings, setOpenStandings] = useState<string | null>(params.get("standings"));
  const [rows, setRows] = useState<StandingsRow[] | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [askingName, setAskingName] = useState<ScheduledTest | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [nameError, setNameError] = useState(false);

  const load = useCallback(async () => {
    const [scheduled, past] = await Promise.all([fetchScheduledTests(), fetchPastTests()]);
    setTests(scheduled.tests);
    setSource(scheduled.source);
    setEntries(past.filter((x) => Boolean(x.scheduledTestId)));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ownByTest = useMemo(() => reduceOwn(entries), [entries]);

  // Present the calendar in a stable, source-independent order: live papers
  // first, then what's coming (soonest first), then finished contests (newest
  // first). The cloud list arrives newest-first while the offline fallback
  // keeps seed order — normalising here makes both read identically.
  const orderedTests = useMemo(() => {
    if (!tests) return tests;
    const rank = (t: ScheduledTest) => {
      const p = phaseOf(t, now);
      return p === "live" ? 0 : p === "upcoming" ? 1 : 2;
    };
    return [...tests].sort((a, b) => {
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      return rank(a) === 2
        ? b.startAt.localeCompare(a.startAt) // ended: newest first
        : a.startAt.localeCompare(b.startAt); // live/upcoming: soonest first
    });
  }, [tests, now]);

  // A leftover draft is meaningless once its attempt has been submitted.
  useEffect(() => {
    const drafts = readDrafts();
    for (const [testId, entry] of ownByTest) {
      if (entry.status === "SUBMITTED" && drafts[testId]) clearDraft(testId);
    }
  }, [ownByTest]);

  // Standings for the expanded contest (deep-linkable via ?standings=).
  useEffect(() => {
    if (!openStandings) {
      setRows(null);
      return;
    }
    let cancelled = false;
    setRowsLoading(true);
    void fetchStandings(openStandings).then((res) => {
      if (cancelled) return;
      setRows(res.rows);
      setRowsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [openStandings]);

  const fmtWhen = (iso: string): string =>
    new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const resumeDraft = (draft: PracticeTest) => {
    sessionStorage.setItem(`test:${draft.id}`, JSON.stringify(draft));
    navigate(`/test/${draft.id}`);
  };

  const beginAttempt = (test: ScheduledTest, name: string) => {
    writeDisplayName(name);
    // Personal clock never runs past the paper's window.
    const windowLeftMin = Math.floor((Date.parse(test.endAt) - now) / 60_000);
    const durationMin = Math.max(1, Math.min(test.durationMin, windowLeftMin));
    const draft: PracticeTest = {
      id: newTestId(),
      clientId: getClientId(),
      title: L(test.title),
      filters: { types: [], topics: [], categories: [], difficulties: [] },
      problemIds: test.problemIds,
      durationMin,
      status: "IN_PROGRESS",
      answers: [],
      score: 0,
      maxScore: test.problemIds.length,
      correctCount: 0,
      startedAt: new Date().toISOString(),
      origin: "local",
      scheduledTestId: test.id,
      displayName: name
    };
    writeDraft(draft);
    sessionStorage.setItem(`test:${draft.id}`, JSON.stringify(draft));
    navigate(`/test/${draft.id}`);
  };

  const requestStart = (test: ScheduledTest) => {
    const entry = ownByTest.get(test.id);
    if (entry?.status === "SUBMITTED") {
      navigate(`/test/${entry.id}/results`);
      return;
    }
    if (entry?.status === "IN_PROGRESS") {
      resumeDraft(entry);
      return;
    }
    const draft = readDrafts()[test.id];
    if (draft) {
      resumeDraft(draft);
      return;
    }
    // Signed-in learners compete under their account name — no name gate.
    if (user) {
      beginAttempt(test, user.displayName);
      return;
    }
    const saved = readDisplayName();
    if (saved) {
      beginAttempt(test, saved);
      return;
    }
    setNameValue("");
    setNameError(false);
    setAskingName(test);
  };

  const confirmName = () => {
    const name = nameValue.trim();
    if (!name) {
      setNameError(true);
      return;
    }
    if (askingName) beginAttempt(askingName, name);
    setAskingName(null);
  };

  return (
    <div className="relative">
      <PageDecor seed={6} />
      <div className="shell py-10 lg:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="eyebrow">{t("tests.eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-4xl">
            {t("tests.title")}
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-400">{t("tests.intro")}</p>
        </div>
        <Link to="/leaderboard" className="btn-ghost">
          <Trophy size={16} /> {t("nav.leaderboard")}
        </Link>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className={`h-1.5 w-1.5 rounded-full ${source === "cloud" ? "bg-emerald-500" : "bg-amber-500"}`} />
          {source === "cloud" ? t("lb.source.cloud") : t("lb.source.local")}
        </p>
        {user && (
          <Link
            to="/login"
            className="chip max-w-full border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-ink-700 dark:bg-ink-900/60 dark:text-slate-300"
          >
            <UserRound size={13} className="shrink-0" />
            <span className="truncate">{t("auth.signedInAs", { name: user.displayName })}</span>
          </Link>
        )}
      </div>

      {orderedTests === null ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 size={16} className="animate-spin" /> {t("misc.loading")}
        </div>
      ) : orderedTests.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center gap-3 px-6 py-20 text-center">
          <CalendarDays size={28} className="text-slate-300 dark:text-slate-600" />
          <p className="text-lg font-semibold text-ink-900 dark:text-white">{t("tests.title")}</p>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{t("tests.empty")}</p>
          <Link to="/practice" className="btn-primary mt-2">
            {t("cta.takeTest")}
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {orderedTests.map((test) => {
            const phase = phaseOf(test, now);
            const entry = ownByTest.get(test.id);
            const draft = entry?.status === "IN_PROGRESS" ? entry : readDrafts()[test.id];
            const submitted = entry?.status === "SUBMITTED" ? entry : undefined;
            const isOpen = openStandings === test.id;

            const until =
              phase === "upcoming"
                ? Date.parse(test.startAt) - now
                : phase === "live"
                  ? Date.parse(test.endAt) - now
                  : 0;

            return (
              <article key={test.id} className="card flex flex-col p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip border border-accent-500/40 bg-accent-500/10 text-accent-700 dark:text-accent-300">
                    {test.kind === "WEEKLY"
                      ? t("kind.weekly")
                      : test.kind === "MONTHLY"
                        ? t("kind.monthly")
                        : t("kind.custom")}
                  </span>
                  <span className={`chip border ${PHASE_CHIP[phase]}`}>
                    {phase === "live" && (
                      <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    )}
                    {t(`tests.phase.${phase}`)}
                  </span>
                  {submitted && (
                    <span className="chip border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      {Math.round((submitted.correctCount / Math.max(1, submitted.maxScore)) * 100)}%
                    </span>
                  )}
                </div>

                <h2 className="mt-3 text-lg font-bold text-ink-900 dark:text-white">{L(test.title)}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {L(test.description)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <FlaskConical size={13} /> {t("tests.problems", { n: test.problemIds.length })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Timer size={13} /> {t("tests.minutes", { n: test.durationMin })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users size={13} /> {t("tests.participants", { n: test.participants ?? 0 })}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={13} /> {fmtWhen(test.startAt)} → {fmtWhen(test.endAt)}
                  </span>
                  {phase !== "ended" && until > 0 && (
                    <span className="inline-flex items-center gap-1.5 font-mono text-ink-900 dark:text-white">
                      <Clock size={13} className="text-accent-500" />
                      {phase === "upcoming" ? t("tests.startsIn") : t("tests.endsIn")}{" "}
                      {fmtCountdown(until, t("time.d"))}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {phase === "upcoming" && (
                    <span className="btn-ghost pointer-events-none opacity-70">
                      <Clock size={14} /> {t("tests.startsAt", { when: fmtWhen(test.startAt) })}
                    </span>
                  )}

                  {phase === "live" &&
                    (submitted ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/test/${submitted.id}/results`)}
                        className="btn-primary h-9 px-3.5 text-xs"
                      >
                        {t("tests.btn.result")} <ArrowRight size={14} />
                      </button>
                    ) : draft ? (
                      <button
                        type="button"
                        onClick={() => resumeDraft(draft)}
                        className="btn-primary h-9 px-3.5 text-xs"
                      >
                        <Play size={14} /> {t("tests.btn.resume")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => requestStart(test)}
                        className="btn-primary h-9 px-3.5 text-xs"
                      >
                        <Play size={14} /> {t("tests.btn.start")}
                      </button>
                    ))}

                  {phase === "ended" && submitted && (
                    <button
                      type="button"
                      onClick={() => navigate(`/test/${submitted.id}/results`)}
                      className="btn-ghost h-9 px-3 text-xs"
                    >
                      {t("tests.btn.result")} <ArrowRight size={14} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setOpenStandings(isOpen ? null : test.id)}
                    className={`btn-quiet h-9 px-3 text-xs ${
                      isOpen ? "bg-accent-500/10 text-accent-700 dark:text-accent-300" : ""
                    }`}
                  >
                    <Trophy size={14} /> {isOpen ? t("tests.btn.hideStandings") : t("tests.btn.standings")}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-4 border-t border-slate-200 pt-4 dark:border-ink-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      {t("tests.standings.title")}
                    </p>
                    {rowsLoading || rows === null ? (
                      <p className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Loader2 size={13} className="animate-spin" /> {t("misc.loading")}
                      </p>
                    ) : rows.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                        {t("tests.standings.empty")}
                      </p>
                    ) : (
                      <StandingsTable rows={rows} clientId={getClientId()} />
                    )}
                    <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
                      {t("tests.standings.hint")}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Display-name gate before the clock starts */}
      {askingName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-ink-900 dark:text-white">{t("tests.name.title")}</h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{t("tests.name.hint")}</p>
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => {
                setNameValue(e.target.value);
                setNameError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmName();
              }}
              maxLength={40}
              placeholder={t("tests.name.placeholder")}
              className={`mt-4 w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition-colors focus:border-accent-500 dark:bg-ink-900 dark:text-white ${
                nameError ? "border-rose-500" : "border-slate-300 dark:border-ink-700"
              }`}
            />
            {nameError && <p className="mt-1.5 text-xs text-rose-500">{t("tests.name.required")}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setAskingName(null)} className="btn-quiet h-9 px-3.5 text-xs">
                {t("admin.problems.cancel")}
              </button>
              <button type="button" onClick={confirmName} className="btn-primary h-9 px-4 text-xs">
                {t("tests.name.submit")}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

/** Ranked list: score %, then faster hand-in (shared maths in lib/leaderboard). */
export function StandingsTable({ rows, clientId }: { rows: StandingsRow[]; clientId: string }) {
  const { t } = useI18n();
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-ink-800">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-400 dark:bg-ink-900/60 dark:text-slate-500">
          <tr>
            <th className="px-3 py-2 font-semibold uppercase tracking-wider">#</th>
            <th className="px-3 py-2 font-semibold uppercase tracking-wider">{t("lb.col.name")}</th>
            <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">{t("lb.col.score")}</th>
            <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider">{t("lb.col.time")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row) => {
            const you = row.isYou || row.clientId === clientId;
            return (
              <tr
                key={row.entryId}
                className={`border-t border-slate-100 dark:border-ink-800 ${you ? "bg-accent-500/10" : ""}`}
              >
                <td className="px-3 py-2 font-mono font-bold text-ink-900 dark:text-white">{row.rank}</td>
                <td className="max-w-[10rem] truncate px-3 py-2 font-medium text-ink-900 dark:text-white">
                  {row.name}
                  {you && (
                    <span className="ml-2 rounded bg-accent-500/20 px-1.5 py-0.5 text-[10px] font-bold text-accent-700 dark:text-accent-300">
                      {t("lb.you")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono text-ink-900 dark:text-white">
                  {row.pct}% <span className="text-slate-400">({row.score}/{row.maxScore})</span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-500 dark:text-slate-400">
                  {formatDuration(row.timeTakenSec)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
