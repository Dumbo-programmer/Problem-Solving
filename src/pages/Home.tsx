import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Crown,
  Globe,
  Layers,
  Medal,
  Sparkles,
  Timer,
  Trophy,
  WifiOff
} from "lucide-react";
import { useI18n, TOPIC_LABELS } from "../lib/i18n";
import { CATEGORIES, TOPICS } from "../data/types";
import { PROBLEMS } from "../data";
import { buildDemoEntries, buildScheduledSeeds, phaseOf } from "../lib/scheduled";
import { standings } from "../lib/leaderboard";
import Reveal from "../components/Reveal";
import MathText from "../components/MathText";
import FloatingMath from "../components/FloatingMath";
import { FloatingPlots, SinePlot } from "../components/MathPlots";
import { DifficultyBadge, TopicBadge, TOPIC_DOT } from "../components/Badges";
import type { ProblemTopic, ScheduledTest, StandingsRow } from "../lib/types";

/**
 * The hero shows a real problem from the bank rather than a mock-up, so it
 * reads in whatever language the site is set to. Shortest olympiad statement
 * wins — compact enough for the card, real enough to be worth solving.
 */
const HERO_PROBLEM = [...PROBLEMS]
  .filter((p) => p.difficulty === "OLYMPIAD")
  .sort((a, b) => a.statement.en.length + a.statement.bn.length - (b.statement.en.length + b.statement.bn.length))[0] ?? PROBLEMS[0];

/**
 * A preview of this week's standings for the home page, built from the same
 * deterministic seeds the server and offline store use — so the podium matches
 * whatever the real board shows. Falls back to the monthly paper (or nothing)
 * when a weekly window is oddly absent.
 */
const PREVIEW: { test: ScheduledTest; top: StandingsRow[] } | null = (() => {
  const tests = buildScheduledSeeds(PROBLEMS, new Date());
  const live =
    tests.find((x) => x.kind === "WEEKLY" && phaseOf(x) === "live") ??
    tests.find((x) => phaseOf(x) === "live");
  if (!live) return null;
  const rows = standings(buildDemoEntries(tests), live.id).slice(0, 3);
  return rows.length ? { test: live, top: rows } : null;
})();

export default function Home() {
  const { t, L } = useI18n();

  const topicCounts = TOPICS.map((topic) => ({
    ...topic,
    count: PROBLEMS.filter((p) => p.topic === topic.key).length
  }));

  const steps = [
    { icon: Sparkles, title: t("home.how1t"), body: t("home.how1d") },
    { icon: CheckCircle2, title: t("home.how2t"), body: t("home.how2d") },
    { icon: Timer, title: t("home.how3t"), body: t("home.how3d") },
    { icon: BookOpen, title: t("home.how4t"), body: t("home.how4d") }
  ];

  const parts = [
    { to: "/problems", icon: Layers, title: t("home.partsBankT"), body: t("home.partsBankD", { n: PROBLEMS.length }) },
    { to: "/practice", icon: Timer, title: t("home.partsTestT"), body: t("home.partsTestD") },
    { to: "/past-tests", icon: BookOpen, title: t("home.partsReviewT"), body: t("home.partsReviewD") }
  ];

  const heroChips = [t("hero.chip1"), t("hero.chip2"), t("hero.chip3"), t("hero.chip4")];

  const contests = [
    { icon: Timer, title: t("home.competeWeeklyT"), body: t("home.competeWeeklyD") },
    { icon: CalendarDays, title: t("home.competeMonthlyT"), body: t("home.competeMonthlyD") },
    { icon: Trophy, title: t("home.competeBoardT"), body: t("home.competeBoardD") }
  ];

  const podiumOrder = PREVIEW ? [1, 0, 2].filter((i) => PREVIEW.top[i]).map((i) => PREVIEW.top[i]) : [];
  const podiumHeights = ["h-24", "h-32", "h-20"];
  const podiumTone = [
    "from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700",
    "from-amber-300 to-amber-500 dark:from-amber-500 dark:to-amber-700",
    "from-orange-300 to-orange-500 dark:from-orange-500 dark:to-orange-700"
  ];

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden">
        {/* decorative background — the retrowave horizon */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid-fade [background-size:26px_26px] opacity-60 dark:opacity-[0.25]" />
          {/* neon sky glows */}
          <div className="absolute -top-32 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-accent-400/20 blur-3xl dark:bg-neon-pink/20" />
          <div className="absolute -left-24 top-24 h-[22rem] w-[22rem] rounded-full bg-ink-400/20 blur-3xl dark:bg-neon-violet/25" />
          <div className="absolute left-1/2 top-0 h-[30rem] w-[36rem] -translate-x-1/2 rounded-full bg-neon-cyan/10 blur-[80px] dark:bg-neon-cyan/15" />
          {/* drifting maths glyphs + live plots */}
          <FloatingMath count={18} seed={3} className="opacity-80 dark:opacity-100" />
          <FloatingPlots count={6} seed={21} className="opacity-60 dark:opacity-80" />
          {/* the rolling perspective floor */}
          <div className="absolute inset-x-0 bottom-0 h-64 overflow-hidden dark:block">
            <div className="retro-horizon" />
          </div>
          <div className="retro-scanlines" />
        </div>

        <div className="shell grid items-center gap-10 pb-16 pt-12 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-20">
          <div>
            <Reveal>
              <span className="chip inline-flex border border-neon-pink/40 bg-neon-pink/10 text-neon-magenta dark:border-neon-pink/50 dark:bg-neon-pink/12 dark:text-neon-pink">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-pink opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neon-pink" />
                </span>
                {t("hero.badge")}
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-ink-900 dark:text-white sm:text-5xl lg:text-6xl">
                {t("hero.title1")}{" "}
                <span className="bg-gradient-to-r from-accent-500 via-accent-400 to-accent-600 bg-clip-text text-transparent dark:from-neon-pink dark:via-neon-purple dark:to-neon-cyan">
                  {t("hero.title2")}
                </span>
              </h1>
            </Reveal>

            <Reveal delay={150}>
              <p className="mt-5 max-w-xl text-balance text-[17px] leading-relaxed text-slate-600 dark:text-slate-400">
                {t("hero.lede", { n: PROBLEMS.length })}
              </p>
            </Reveal>

            <Reveal delay={220}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/problems" className="btn-primary px-5 py-3 text-[15px]">
                  {t("cta.browseProblems")}
                  <ArrowRight size={17} />
                </Link>
                <Link to="/practice" className="btn-ghost px-5 py-3 text-[15px]">
                  {t("cta.takeTest")}
                </Link>
              </div>
            </Reveal>

            <Reveal delay={300}>
              <dl className="mt-12 grid max-w-lg grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
                {[
                  { value: PROBLEMS.length, label: t("hero.statProblems") },
                  { value: TOPICS.length, label: t("hero.statTopics") },
                  { value: CATEGORIES.length, label: t("hero.statLevels") },
                  { value: "2", label: t("hero.statLangs") }
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="font-mono text-2xl font-bold text-ink-900 dark:text-white">
                      {stat.value}
                    </dt>
                    <dd className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
                      {stat.label}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal delay={300}>
              <a
                href="https://www.prothomalo.com/collection/math-school"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex items-center gap-2.5 rounded-2xl border border-palo/20 bg-white/70 px-3.5 py-2.5 shadow-soft backdrop-blur transition-colors hover:border-palo/40 dark:bg-ink-900/50"
              >
                <img src="/prothom-alo.svg" alt="প্রথম আলো" className="h-5 w-auto dark:hidden" loading="lazy" decoding="async" />
                <img src="/prothom-alo-dark.svg" alt="প্রথম আলো" className="hidden h-5 w-auto dark:block" loading="lazy" decoding="async" />
                <span className="h-6 w-px bg-slate-200 dark:bg-ink-700" aria-hidden />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("footer.visitPalo")}
                </span>
              </a>
            </Reveal>

            <Reveal delay={360}>
              <ul className="mt-8 flex flex-wrap gap-2">
                {heroChips.map((chip) => (
                  <li
                    key={chip}
                    className="chip border-slate-200 bg-white/70 text-slate-600 dark:border-ink-700 dark:bg-ink-900/60 dark:text-slate-300"
                  >
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    {chip}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* Hero visual — a real problem from the bank, already solved */}
          <Reveal delay={200} className="hidden lg:block">
            <div className="relative animate-floaty">
              <div className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    <DifficultyBadge value={HERO_PROBLEM.difficulty} />
                    <TopicBadge value={HERO_PROBLEM.topic} />
                  </div>
                  {HERO_PROBLEM.source && (
                    <span className="shrink-0 font-mono text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                      {HERO_PROBLEM.source}
                    </span>
                  )}
                </div>

                <p className="mt-4 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                  <MathText>{L(HERO_PROBLEM.statement)}</MathText>
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1 rounded-xl border border-emerald-500/50 bg-white px-3 py-2.5 font-mono text-sm font-semibold text-ink-900 shadow-soft dark:bg-ink-900 dark:text-white">
                    <MathText>{HERO_PROBLEM.answer}</MathText>
                  </div>
                  <span className="chip border border-emerald-500/50 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 size={13} /> {t("archive.correct")}
                  </span>
                </div>

                <Link
                  to="/problems"
                  className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3.5 text-xs font-semibold text-accent-600 transition-colors hover:text-accent-700 dark:border-ink-700 dark:text-accent-400 dark:hover:text-accent-300"
                >
                  {t("action.seeSolution")} <ArrowRight size={13} />
                </Link>
              </div>

              {/* floating solution pill */}
              <div className="absolute -left-8 bottom-10 hidden animate-floaty card px-4 py-3 xl:block" style={{ animationDelay: "1.4s" }}>
                <div className="flex items-center gap-2 text-sm font-semibold text-accent-600 dark:text-accent-400">
                  <BookOpen size={16} /> {t("result.explanation")}
                </div>
              </div>

              {/* floating live-plot card — the maths literally moving */}
              <div
                className="absolute -right-6 -top-8 hidden animate-floaty rounded-2xl border border-slate-200 bg-white/85 px-3 py-2 shadow-soft backdrop-blur xl:block dark:border-neon-cyan/30 dark:bg-ink-900/80"
                style={{ animationDelay: "0.8s" }}
              >
                <SinePlot className="h-16 w-40 text-slate-400" phase={0.6} />
              </div>

              {/* glowing orbit mirror behind the card */}
              <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
                <div className="h-72 w-72 rounded-full bg-gradient-to-br from-neon-pink/25 via-neon-violet/20 to-neon-cyan/25 blur-3xl dark:from-neon-pink/30 dark:via-neon-violet/25 dark:to-neon-cyan/30" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="shell py-14 lg:py-20">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">{t("home.howEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 dark:text-white">
            {t("home.howTitle")}
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 80}>
              <div className="card h-full p-5 transition-transform duration-200 hover:-translate-y-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-ink-700 to-ink-900 text-white shadow-soft">
                  <step.icon size={19} />
                </div>
                <h3 className="mt-4 text-[15px] font-bold text-ink-900 dark:text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- Platform parts ---------------- */}
      <section className="border-y border-slate-200 bg-white/60 py-14 dark:border-ink-800 dark:bg-ink-900/20 lg:py-20">
        <div className="shell">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">{t("home.partsEyebrow")}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 dark:text-white">
              {t("home.partsTitle")}
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">{t("home.partsLede")}</p>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {parts.map((part, i) => (
              <Reveal key={part.to} delay={i * 80}>
                <Link
                  to={part.to}
                  className="card group flex h-full flex-col p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-ink-700 to-ink-900 text-white shadow-soft">
                    <part.icon size={19} />
                  </div>
                  <h3 className="mt-4 text-[15px] font-bold text-ink-900 dark:text-white">{part.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {part.body}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-600 transition-transform group-hover:translate-x-0.5 dark:text-accent-400">
                    {t("home.partsOpen")} <ArrowRight size={13} />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Compete: contests + live podium ---------------- */}
      <section className="shell py-14 lg:py-20">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">{t("home.competeEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 dark:text-white">
            {t("home.competeTitle")}
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">{t("home.competeLede")}</p>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          {/* three contest cards */}
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {contests.map((c, i) => (
              <Reveal key={c.title} delay={i * 70}>
                <div className="card flex h-full items-start gap-4 p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-soft">
                    <c.icon size={19} />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-bold text-ink-900 dark:text-white">{c.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{c.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* live podium preview */}
          <Reveal delay={140}>
            <div className="relative h-full overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-accent-50/60 p-6 shadow-soft dark:border-ink-800 dark:from-ink-900 dark:via-ink-950 dark:to-ink-900">
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent-400/15 blur-3xl" />
              <div className="relative flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-ink-900 dark:text-white">{t("home.competeStandings")}</h3>
                {PREVIEW && (
                  <span className="chip border-accent-500/40 bg-accent-500/10 text-accent-700 dark:text-accent-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-500" />
                    {t("home.competeLive")}
                  </span>
                )}
              </div>
              <p className="relative mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {PREVIEW ? t("kind.weekly") : ""}
              </p>

              {PREVIEW ? (
                <>
                  <div className="relative mt-6 flex items-end justify-center gap-3">
                    {podiumOrder.map((row) => {
                      // Which of the three lanes this row sits in.
                      const lane = PREVIEW.top.indexOf(row);
                      return (
                        <div key={row.clientId} className="flex w-1/3 flex-col items-center">
                          <span className="mb-2 grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-[11px] font-bold text-white shadow-soft">
                            {lane === 0 ? <Crown size={16} /> : <Medal size={16} />}
                          </span>
                          <span className="w-full truncate text-center text-xs font-semibold text-ink-900 dark:text-white">
                            {row.name}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {row.score}/{row.maxScore} · {row.pct}%
                          </span>
                          <div
                            className={`mt-2 w-full rounded-t-lg bg-gradient-to-b ${podiumHeights[lane]} ${podiumTone[lane]}`}
                          >
                            <span className="block pt-2 text-center font-mono text-lg font-bold text-white/90">
                              {lane + 1}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="relative mt-6 text-sm text-slate-500 dark:text-slate-400">{t("lb.empty")}</p>
              )}

              <div className="relative mt-6 flex flex-wrap gap-3 border-t border-slate-200/70 pt-5 dark:border-ink-800">
                <Link to="/tests" className="btn-primary h-9 px-3.5 text-xs">
                  {t("home.competeOpen")}
                </Link>
                <Link to="/leaderboard" className="btn-ghost h-9 px-3.5 text-xs">
                  <Trophy size={14} /> {t("home.competeBoard")}
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Topics ---------------- */}
      <section className="border-y border-slate-200 bg-slate-50/60 py-14 dark:border-ink-800 dark:bg-ink-900/30 lg:py-20">
        <div className="shell">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">{t("filter.topic")}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 dark:text-white">
              {t("home.topicsTitle")}
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">{t("home.topicsLede")}</p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topicCounts.map((topic, i) => (
              <Reveal key={topic.key} delay={i * 60}>
                <Link
                  to={`/problems?topic=${topic.key}`}
                  className="card group block h-full p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift"
                >
                  <div className="flex items-center justify-between">
                    <span className={`h-2.5 w-2.5 rounded-full ${TOPIC_DOT[topic.key as ProblemTopic]}`} />
                    <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">
                      {topic.count} {t("home.problemsIn")}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-ink-900 dark:text-white">
                    {L(TOPIC_LABELS[topic.key as ProblemTopic])}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {L(topic.blurb)}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-accent-400">
                    {t("cta.browseProblems")} <ArrowRight size={13} />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Feature strip + CTA ---------------- */}
      <section className="shell py-14 lg:py-20">
        <div className="grid gap-5 lg:grid-cols-3">
          {[
            { icon: Sparkles, title: t("home.featuredBdmo"), body: t("home.featuredBdmoD") },
            { icon: Globe, title: t("home.featuredBn"), body: t("home.featuredBnD") },
            { icon: WifiOff, title: t("home.featuredOffline"), body: t("home.featuredOfflineD") }
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 70}>
              <div className="flex h-full gap-4 p-1">
                <f.icon size={22} className="mt-0.5 shrink-0 text-accent-500" />
                <div>
                  <h3 className="text-[15px] font-bold text-ink-900 dark:text-white">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{f.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div className="relative mt-14 overflow-hidden rounded-3xl bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-8 text-center shadow-lift sm:p-14">
            <div className="pointer-events-none absolute inset-0 bg-grid-fade [background-size:22px_22px] opacity-30" />
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-neon-pink/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-neon-cyan/25 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 overflow-hidden">
              <div className="retro-horizon !h-40" />
            </div>
            <div className="retro-scanlines" />
            <div className="relative">
              <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {t("home.practiceCtaTitle")}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-slate-300">
                {t("home.practiceCtaLede")}
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link to="/problems" className="btn-primary px-6 py-3 text-[15px]">
                  {t("cta.browseProblems")}
                  <ArrowRight size={17} />
                </Link>
                <Link
                  to="/practice"
                  className="btn px-6 py-3 text-[15px] text-white ring-1 ring-white/25 hover:bg-white/10"
                >
                  {t("cta.takeTest")}
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
