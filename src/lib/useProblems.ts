import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Problem, TestFilters } from "./types";
import { PROBLEMS } from "../data";
import { fetchProblems, type CloudState, getCloudState, onCloudStateChange } from "./api";

/**
 * Loads the problem bank, preferring Supabase when reachable and falling back
 * to the bundled copy. Re-runs whenever the active filters change.
 */
export function useProblemBank(filters: Partial<TestFilters> = {}) {
  const key = useMemo(
    () =>
      JSON.stringify({
        types: filters.types ?? [],
        topics: filters.topics ?? [],
        categories: filters.categories ?? [],
        difficulties: filters.difficulties ?? []
      }),
    [filters.types, filters.topics, filters.categories, filters.difficulties]
  );

  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"cloud" | "local">("local");
  const [cloud, setCloud] = useState<CloudState>(() => getCloudState());
  const mounted = useRef(true);

  useEffect(() => onCloudStateChange(setCloud), []);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    setLoading(true);
    fetchProblems(JSON.parse(key)).then((res) => {
      if (cancelled || !mounted.current) return;
      setProblems(res.problems);
      setSource(res.source);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [key]);

  /** Counts across the whole bank, used to annotate filter chips. */
  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const p of PROBLEMS) {
      for (const k of [p.type, p.topic, p.category, p.difficulty]) {
        tally[k] = (tally[k] ?? 0) + 1;
      }
    }
    return tally as Partial<Record<string, number>>;
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchProblems(JSON.parse(key)).then((res) => {
      setProblems(res.problems);
      setSource(res.source);
      setLoading(false);
    });
  }, [key]);

  return { problems, loading, source, cloud, counts, refresh };
}
