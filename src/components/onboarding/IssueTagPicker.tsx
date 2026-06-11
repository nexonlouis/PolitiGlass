"use client";

import type { IssueTagDefinition } from "@/lib/constants/issue-tags";
import {
  defaultStanceForHighlight,
  getHighlightsForAnchor,
  getTagBySlug,
} from "@/lib/constants/issue-tag-graph";
import type { IssueStance, IssueTagPreference } from "@/lib/types/issue-tags";

interface IssueTagPickerProps {
  displayTags: IssueTagDefinition[];
  suggestedSlugs: string[];
  preferences: IssueTagPreference[];
  anchorSlug: string | null;
  onPreferencesChange: (next: IssueTagPreference[]) => void;
  onAnchorChange: (slug: string | null) => void;
}

const MAX_TAGS = 8;
const MIN_TAGS = 3;

function isSelected(preferences: IssueTagPreference[], slug: string) {
  return preferences.some((p) => p.slug === slug);
}

export function IssueTagPicker({
  displayTags,
  suggestedSlugs,
  preferences,
  anchorSlug,
  onPreferencesChange,
  onAnchorChange,
}: IssueTagPickerProps) {
  const selectedSlugs = preferences.map((p) => p.slug);
  const highlights = getHighlightsForAnchor(anchorSlug, selectedSlugs);

  const addTag = (slug: string, stance: IssueStance) => {
    if (isSelected(preferences, slug)) return;
    if (preferences.length >= MAX_TAGS) return;
    onPreferencesChange([...preferences, { slug, weight: 3, stance }]);
    onAnchorChange(slug);
  };

  const removeTag = (slug: string) => {
    onPreferencesChange(preferences.filter((p) => p.slug !== slug));
    if (anchorSlug === slug) onAnchorChange(null);
  };

  const toggleFromGrid = (slug: string) => {
    if (isSelected(preferences, slug)) {
      removeTag(slug);
      return;
    }
    addTag(slug, "support");
  };

  const toggleStance = (slug: string) => {
    onPreferencesChange(
      preferences.map((p) =>
        p.slug === slug
          ? { ...p, stance: p.stance === "support" ? "oppose" : "support" }
          : p,
      ),
    );
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Choose {MIN_TAGS}–{MAX_TAGS} issues. Track issues you{" "}
        <span className="font-medium text-emerald-700 dark:text-emerald-400">support</span> or{" "}
        <span className="font-medium text-amber-700 dark:text-amber-400">oppose</span>. Tap a
        tag to see related options.
      </p>

      {preferences.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Your priorities ({preferences.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {preferences.map((pref) => {
              const label = getTagBySlug(pref.slug)?.label ?? pref.slug;
              const isSupport = pref.stance === "support";
              return (
                <div
                  key={pref.slug}
                  className="flex items-center gap-1 rounded-full border border-slate-300 bg-white pl-3 pr-1 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
                >
                  <span className="font-medium">{label}</span>
                  <button
                    type="button"
                    onClick={() => toggleStance(pref.slug)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                      isSupport
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                    title="Toggle support vs oppose"
                  >
                    {isSupport ? "Support" : "Oppose"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTag(pref.slug)}
                    className="ml-1 rounded-full px-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    aria-label={`Remove ${label}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(highlights.pro.length > 0 || highlights.anti.length > 0) && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Related to{" "}
            <span className="font-medium">
              {getTagBySlug(anchorSlug!)?.label ?? anchorSlug}
            </span>
            :
          </p>
          {highlights.pro.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Often aligned — adds as Support
              </p>
              <div className="flex flex-wrap gap-2">
                {highlights.pro.map((tag) => (
                  <button
                    key={tag.slug}
                    type="button"
                    onClick={() => addTag(tag.slug, defaultStanceForHighlight("pro"))}
                    disabled={preferences.length >= MAX_TAGS}
                    className="rounded-full border-2 border-emerald-600/60 bg-white px-3 py-1 text-sm text-emerald-900 hover:bg-emerald-50 disabled:opacity-40 dark:border-emerald-500/50 dark:bg-slate-900 dark:text-emerald-200"
                  >
                    + {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {highlights.anti.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-amber-800 dark:text-amber-400">
                Often opposed — adds as Oppose
              </p>
              <div className="flex flex-wrap gap-2">
                {highlights.anti.map((tag) => (
                  <button
                    key={tag.slug}
                    type="button"
                    onClick={() => addTag(tag.slug, defaultStanceForHighlight("anti"))}
                    disabled={preferences.length >= MAX_TAGS}
                    className="rounded-full border-2 border-amber-600/60 bg-white px-3 py-1 text-sm text-amber-950 hover:bg-amber-50 disabled:opacity-40 dark:border-amber-500/50 dark:bg-slate-900 dark:text-amber-200"
                  >
                    + {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          All issues
        </p>
        <div className="flex flex-wrap gap-2">
          {displayTags.map((tag) => {
            const selected = isSelected(preferences, tag.slug);
            const suggested = suggestedSlugs.includes(tag.slug);
            const isAnchor = anchorSlug === tag.slug && selected;

            return (
              <button
                key={tag.slug}
                type="button"
                onClick={() => toggleFromGrid(tag.slug)}
                title={tag.description}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  selected
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : suggested
                      ? "border-2 border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800"
                      : "border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                } ${isAnchor ? "ring-2 ring-slate-400 ring-offset-1" : ""}`}
              >
                {tag.label}
                {suggested && !selected && (
                  <span className="ml-1 text-[10px] opacity-70">· suggested</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
