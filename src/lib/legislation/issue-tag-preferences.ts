import type { IssueStance, IssueTagPreference } from "@/lib/types/issue-tags";

const STANCES = new Set<IssueStance>(["support", "oppose"]);

function isStance(value: unknown): value is IssueStance {
  return typeof value === "string" && STANCES.has(value as IssueStance);
}

/**
 * Normalizes issue_tag_weights jsonb (legacy number or { weight, stance }).
 */
export function parseIssueTagWeights(
  tags: string[],
  raw: unknown,
): IssueTagPreference[] {
  const record =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return tags.map((slug) => {
    const entry = record[slug];
    if (typeof entry === "number") {
      return { slug, weight: entry, stance: "support" as const };
    }
    if (entry && typeof entry === "object") {
      const obj = entry as { weight?: unknown; stance?: unknown };
      return {
        slug,
        weight: typeof obj.weight === "number" ? obj.weight : 3,
        stance: isStance(obj.stance) ? obj.stance : "support",
      };
    }
    return { slug, weight: 3, stance: "support" as const };
  });
}

export function preferencesToWeightsJson(
  preferences: IssueTagPreference[],
): Record<string, { weight: number; stance: IssueStance }> {
  return Object.fromEntries(
    preferences.map((p) => [p.slug, { weight: p.weight, stance: p.stance }]),
  );
}

export function parsePreferencesFromQuery(
  tags: string[],
  searchParams: URLSearchParams,
): IssueTagPreference[] {
  return tags.map((slug) => ({
    slug,
    weight: Number(searchParams.get(`weight_${slug}`)) || 3,
    stance: isStance(searchParams.get(`stance_${slug}`))
      ? (searchParams.get(`stance_${slug}`) as IssueStance)
      : "support",
  }));
}
