import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CheckCircle2, Globe, Layers, Sparkles, Timer, WifiOff } from "lucide-react";
import { useI18n, TOPIC_LABELS } from "../lib/i18n";
import { CATEGORIES, TOPICS } from "../data/types";
import { PROBLEMS } from "../data";
import Reveal from "../components/Reveal";
import MathText from "../components/MathText";
import { DifficultyBadge, TopicBadge, TOPIC_DOT } from "../components/Badges";
import type { ProblemTopic } from "../lib/types";

/**
 * The hero shows a real problem from the bank rather than a mock-up, so it
 * reads in whatever language the site is set to. Shortest olympiad statement
 * wins — compact enough for the card, real enough to be worth solving.
 */
const HERO_PROBLEM = [...PROBLEMS]
  .filter((p) => p.difficulty === "OLYMPIAD")
  .sort((a, b) => a.statement.en.length + a.statement.bn.length - (b.statement.en.length + b.statement.bn.length))[0] ?? PROBLEMS[0];

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

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden">
        {/* decorative background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid-fade [background-size:26px_26px] dark:opacity-[0.35]" />
          <div className="absolute -top-32 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-accent-400/20 blur-3xl dark:bg-accent-600/10" />
          <div className="absolute -left-24 top-24 h-[22rem] w-[22rem] rounded-full bg-ink-400/20 blur-3xl dark:bg-ink-600/15" />
        </div>

        <div className="shell grid items-center gap-10 pb-16 pt-12 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-20">
          <div>
            <Reveal>
              <span className="chip inline-flex border border-accent-500/40 bg-accent-500/10 text-accent-700 dark:text-accent-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-500" />
                </span>
                {t("hero.badge")}
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-ink-900 dark:text-white sm:text-5xl lg:text-6xl">
                {t("hero.title1")}{" "}
                <span className="bg-gradient-to-r from-accent-500 via-accent-400 to-accent-600 bg-clip-text text-transparent">
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
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent-500/25 blur-3xl" />
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
