import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Timer, Trophy } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { CATEGORIES, TOPICS } from "../data/types";
import { PROBLEMS } from "../data";
import { buildDemoEntries, buildScheduledSeeds } from "../lib/scheduled";
import { overallLeaderboard } from "../lib/leaderboard";
import { FeatureRow, Section, SectionHeading, StatsStrip } from "../components/Layout";
import LeaderboardList from "../components/LeaderboardList";

/**
 * A small, honest slice of the overall board: the same deterministic demo
 * field the API serves, so the home page never claims a standing that the
 * full leaderboard would contradict.
 */
const HOME_BOARD = (() => {
  const tests = buildScheduledSeeds(PROBLEMS, new Date());
  return overallLeaderboard(buildDemoEntries(tests), { window: "all" }).slice(0, 5);
})();

export default function Home() {
  const { t } = useI18n();

  const features = [
    {
      icon: BookOpen,
      title: t("home.simplePracticeT"),
      body: t("home.simplePracticeD", { n: PROBLEMS.length }),
      to: "/problems",
      cta: t("cta.browseProblems")
    },
    {
      icon: Timer,
      title: t("home.simpleTestT"),
      body: t("home.simpleTestD"),
      to: "/practice",
      cta: t("cta.takeTest")
    },
    {
      icon: Trophy,
      title: t("home.simpleCompeteT"),
      body: t("home.simpleCompeteD"),
      to: "/contests",
      cta: t("home.simpleCompeteCta")
    }
  ];

  return (
    <>
      {/* ---------------- Hero + numbers ---------------- */}
      <section className="border-b border-slate-200">
        <div className="shell pb-14 pt-14 lg:pb-20 lg:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
              {t("home.simpleHeroTitle")}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-slate-600">
              {t("home.simpleHeroSub")}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/problems" className="btn-primary px-5 py-3 text-[15px]">
                {t("cta.browseProblems")}
                <ArrowRight size={17} />
              </Link>
              <Link to="/practice" className="btn-ghost px-5 py-3 text-[15px]">
                {t("cta.takeTest")}
              </Link>
            </div>
          </div>

          <StatsStrip
            className="mx-auto mt-14 max-w-3xl border-t border-slate-200 pt-10"
            items={[
              { value: PROBLEMS.length, label: t("hero.statProblems") },
              { value: TOPICS.length, label: t("hero.statTopics") },
              { value: CATEGORIES.length, label: t("hero.statLevels") }
            ]}
          />
        </div>
      </section>

      {/* ---------------- What the platform does ---------------- */}
      <Section>
        <div className="space-y-16 lg:space-y-24">
          {features.map((feature, i) => (
            <FeatureRow key={feature.title} {...feature} flip={i % 2 === 1} />
          ))}
        </div>
      </Section>

      {/* ---------------- Leaderboard preview ---------------- */}
      <Section bordered className="bg-slate-50/60">
        <SectionHeading title={t("home.simpleLbTitle")} description={t("home.simpleLbD")} />

        <div className="card mt-8 overflow-hidden">
          {HOME_BOARD.length > 0 ? (
            <LeaderboardList rows={HOME_BOARD} />
          ) : (
            <p className="px-5 py-10 text-center text-sm text-slate-500">{t("lb.empty")}</p>
          )}
        </div>

        <Link
          to="/leaderboard"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-700 transition-colors hover:text-accent-600"
        >
          {t("home.simpleLbViewAll")}
          <ArrowRight size={15} strokeWidth={1.75} />
        </Link>
      </Section>

      {/* ---------------- Closing call to action ---------------- */}
      <Section>
        <div className="rounded-panel border border-slate-200 bg-slate-50/70 px-6 py-12 text-center sm:px-12">
          <h2 className="text-balance text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            {t("home.simpleCtaTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed text-slate-600">
            {t("home.simpleCtaD")}
          </p>
          <div className="mt-7">
            <Link to="/problems" className="btn-primary px-5 py-3 text-[15px]">
              {t("cta.browseProblems")}
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
