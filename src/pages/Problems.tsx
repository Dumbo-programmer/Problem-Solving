import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Inbox } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useProblemBank } from "../lib/useProblems";
import { filterProblems } from "../lib/filters";
import FilterPanel, { EMPTY_FACETS, facetsToFilters, type FacetState } from "../components/FilterPanel";
import ProblemCard from "../components/ProblemCard";
import PageDecor from "../components/PageDecor";
import type { ProblemTopic } from "../lib/types";

/**
 * The browsable problem archive. Reads `?topic=` from the URL so topic cards
 * on the home page can deep-link straight into a filtered list.
 */
export default function Problems() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [facets, setFacets] = useState<FacetState>(EMPTY_FACETS);

  // Mirror a deep-linked topic into the facet state (and keep the URL clean).
  useEffect(() => {
    const topic = params.get("topic");
    if (topic) {
      setFacets((prev) => ({ ...prev, topics: [topic as ProblemTopic] }));
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const { problems: bank, loading, counts } = useProblemBank(facetsToFilters(facets));

  const results = useMemo(
    () => filterProblems(bank, { ...facetsToFilters(facets), search: facets.search }),
    [bank, facets]
  );

  return (
    <div className="relative">
      <PageDecor seed={2} />
      <div className="shell py-10 lg:py-14">
      <header className="max-w-2xl">
        <p className="eyebrow">{t("nav.problems")}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-4xl">
          {t("archive.title")}
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{t("archive.lede")}</p>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[19rem_1fr]">
        <aside className="lg:sticky lg:top-20">
          <FilterPanel value={facets} onChange={setFacets} counts={counts} />
        </aside>

        <section>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="font-mono font-semibold text-ink-900 dark:text-white">{results.length}</span>{" "}
              {t("filter.matching")}
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card h-24 animate-pulse bg-slate-100/70 dark:bg-ink-900/50" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
              <Inbox size={26} className="text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-ink-900 dark:text-white">{t("filter.none")}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("filter.noneHint")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((problem, i) => (
                <ProblemCard key={problem.id} problem={problem} index={i + 1} />
              ))}
            </div>
          )}
        </section>
      </div>
      </div>
    </div>
  );
}
