import { Search, RotateCcw } from "lucide-react";
import { CATEGORIES, DIFFICULTIES, TOPICS, TYPES } from "../data/types";
import type { ProblemCategory, ProblemDifficulty, ProblemTopic, ProblemType } from "../lib/types";
import { useI18n } from "../lib/i18n";
import { CATEGORY_LABELS, DIFFICULTY_LABELS, TOPIC_LABELS, TYPE_LABELS } from "../lib/i18n";

/**
 * The four-facet filter control (Type / Topic / Category / Difficulty) plus an
 * optional search box. Shared verbatim between the problem archive and the
 * practice-test builder so both surfaces behave identically.
 */

export interface FacetState {
  types: ProblemType[];
  topics: ProblemTopic[];
  categories: ProblemCategory[];
  difficulties: ProblemDifficulty[];
  search: string;
}

export const EMPTY_FACETS: FacetState = {
  types: [],
  topics: [],
  categories: [],
  difficulties: [],
  search: ""
};

function toggle<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FacetRow<T extends string>({
  label,
  options,
  selected,
  onChange,
  render
}: {
  label: string;
  options: { key: T; count?: number }[];
  selected: T[];
  onChange: (next: T[]) => void;
  render: (key: T) => string;
}) {
  const { t } = useI18n();
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] font-medium text-accent-600 hover:underline"
          >
            {t("filter.any")}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange([])}
          className={`toggle-chip ${selected.length === 0 ? "toggle-chip-on" : "toggle-chip-off"}`}
        >
          {t("filter.all")}
        </button>
        {options.map((opt) => {
          const on = selected.includes(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(toggle(selected, opt.key))}
              className={`toggle-chip ${on ? "toggle-chip-on" : "toggle-chip-off"}`}
              aria-pressed={on}
            >
              {render(opt.key)}
              {typeof opt.count === "number" && (
                <span className="font-mono text-[11px] opacity-60">{opt.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  value: FacetState;
  onChange: (next: FacetState) => void;
  /** Optional per-facet counts shown next to each chip. */
  counts?: Partial<Record<ProblemType | ProblemTopic | ProblemCategory | ProblemDifficulty, number>>;
  showSearch?: boolean;
}

export default function FilterPanel({ value, onChange, counts = {}, showSearch = true }: Props) {
  const { t, L } = useI18n();
  const isDirty =
    value.types.length > 0 ||
    value.topics.length > 0 ||
    value.categories.length > 0 ||
    value.difficulties.length > 0 ||
    value.search.trim().length > 0;

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-ink-900">{t("filter.title")}</h2>
        {isDirty && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FACETS)}
            className="btn-quiet h-8 px-2.5 text-xs"
          >
            <RotateCcw size={14} />
            {t("action.clearAll")}
          </button>
        )}
      </div>

      {showSearch && (
        <div className="relative mt-3">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder={t("filter.search")}
            className="field pl-10"
            aria-label={t("filter.search")}
          />
        </div>
      )}

      {/* The facets scroll inside the panel so a short viewport never pushes
          the page long — search and the reset button stay pinned above. */}
      <div className="scroll-area mt-5 max-h-[55vh] space-y-5 overflow-y-auto pr-2 lg:max-h-[calc(100vh-12rem)]">
        <FacetRow
          label={t("filter.type")}
          options={TYPES.map((x) => ({ key: x.key, count: counts[x.key] }))}
          selected={value.types}
          onChange={(next) => onChange({ ...value, types: next })}
          render={(k) => L(TYPE_LABELS[k])}
        />
        <FacetRow
          label={t("filter.topic")}
          options={TOPICS.map((x) => ({ key: x.key, count: counts[x.key] }))}
          selected={value.topics}
          onChange={(next) => onChange({ ...value, topics: next })}
          render={(k) => L(TOPIC_LABELS[k])}
        />
        <FacetRow
          label={t("filter.category")}
          options={CATEGORIES.map((x) => ({ key: x.key, count: counts[x.key] }))}
          selected={value.categories}
          onChange={(next) => onChange({ ...value, categories: next })}
          render={(k) => L(CATEGORY_LABELS[k])}
        />
        <FacetRow
          label={t("filter.difficulty")}
          options={DIFFICULTIES.map((x) => ({ key: x.key, count: counts[x.key] }))}
          selected={value.difficulties}
          onChange={(next) => onChange({ ...value, difficulties: next })}
          render={(k) => L(DIFFICULTY_LABELS[k])}
        />
      </div>
    </div>
  );
}

/** Turn the facet state into the shape the API/filter helpers expect. */
export function facetsToFilters(f: FacetState): {
  types: ProblemType[];
  topics: ProblemTopic[];
  categories: ProblemCategory[];
  difficulties: ProblemDifficulty[];
  search: string;
} {
  return {
    types: f.types,
    topics: f.topics,
    categories: f.categories,
    difficulties: f.difficulties,
    search: f.search
  };
}
