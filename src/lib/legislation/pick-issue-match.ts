import type { IssueStance, IssueTagPreference } from "@/lib/types/issue-tags";

export interface IssueMatch {
  issueSlug: string;
  userStance: IssueStance;
  weight: number;
}

/**
 * Picks the best issue-tag match between bill tags and user priorities.
 * Returns null when there is no overlap (vote excluded from reflection scoring).
 */
export function pickIssueMatch(
  billIssueSlugs: string[] | null | undefined,
  preferences: IssueTagPreference[],
): IssueMatch | null {
  const billTags = billIssueSlugs ?? [];
  if (billTags.length === 0 || preferences.length === 0) return null;

  const prefBySlug = new Map(preferences.map((p) => [p.slug, p]));
  let best: IssueMatch | null = null;

  for (const slug of billTags) {
    const pref = prefBySlug.get(slug);
    if (!pref) continue;

    if (!best || pref.weight > best.weight) {
      best = {
        issueSlug: slug,
        userStance: pref.stance,
        weight: pref.weight,
      };
    }
  }

  return best;
}
