import type { IssueTagDefinition } from "@/lib/constants/issue-tags";
import { ISSUE_TAGS, ISSUE_TAG_SLUGS } from "@/lib/constants/issue-tags";
import type { IssueStance } from "@/lib/types/issue-tags";

const SLUG_SET = new Set(ISSUE_TAG_SLUGS);

const TAG_BY_SLUG = new Map(ISSUE_TAGS.map((t) => [t.slug, t]));

export function getTagBySlug(slug: string): IssueTagDefinition | undefined {
  return TAG_BY_SLUG.get(slug);
}

export function getRelatedPro(slug: string): string[] {
  return getTagBySlug(slug)?.pro ?? [];
}

export function getRelatedAnti(slug: string): string[] {
  return getTagBySlug(slug)?.anti ?? [];
}

export interface TagHighlights {
  pro: IssueTagDefinition[];
  anti: IssueTagDefinition[];
}

/**
 * Pro/anti tags for the anchor selection, excluding already-selected slugs.
 */
export function getHighlightsForAnchor(
  anchorSlug: string | null,
  selectedSlugs: string[],
): TagHighlights {
  if (!anchorSlug) return { pro: [], anti: [] };

  const selected = new Set(selectedSlugs);
  const def = getTagBySlug(anchorSlug);
  if (!def) return { pro: [], anti: [] };

  const toDefs = (slugs: string[] | undefined) =>
    (slugs ?? [])
      .filter((s) => !selected.has(s) && SLUG_SET.has(s))
      .map((s) => getTagBySlug(s)!)
      .filter(Boolean);

  return {
    pro: toDefs(def.pro),
    anti: toDefs(def.anti),
  };
}

/**
 * Sort tags for display: demographic rank first, then default popularity (ISSUE_TAGS order).
 */
export function sortTagsForDisplay(
  demographicScores: Map<string, number>,
): IssueTagDefinition[] {
  const popularityIndex = new Map(ISSUE_TAGS.map((t, i) => [t.slug, i]));

  return [...ISSUE_TAGS].sort((a, b) => {
    const scoreDiff =
      (demographicScores.get(b.slug) ?? 0) - (demographicScores.get(a.slug) ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (popularityIndex.get(a.slug) ?? 0) - (popularityIndex.get(b.slug) ?? 0);
  });
}

/** Top N slugs by display sort (for “suggested” badges). */
export function getTopSuggestedSlugs(
  demographicScores: Map<string, number>,
  limit = 8,
): string[] {
  return sortTagsForDisplay(demographicScores).slice(0, limit).map((t) => t.slug);
}

export function defaultStanceForHighlight(kind: "pro" | "anti"): IssueStance {
  return kind === "pro" ? "support" : "oppose";
}

export interface TagGraphValidationError {
  slug: string;
  field: "pro" | "anti";
  invalidRef: string;
}

/** Ensures every pro/anti reference is a valid slug. */
export function validateTagGraph(): TagGraphValidationError[] {
  const errors: TagGraphValidationError[] = [];

  for (const tag of ISSUE_TAGS) {
    for (const ref of tag.pro ?? []) {
      if (!SLUG_SET.has(ref)) {
        errors.push({ slug: tag.slug, field: "pro", invalidRef: ref });
      }
    }
    for (const ref of tag.anti ?? []) {
      if (!SLUG_SET.has(ref)) {
        errors.push({ slug: tag.slug, field: "anti", invalidRef: ref });
      }
    }
  }

  return errors;
}

if (process.env.NODE_ENV !== "production") {
  const graphErrors = validateTagGraph();
  if (graphErrors.length > 0) {
    console.warn("[issue-tag-graph] invalid pro/anti references:", graphErrors);
  }
}
