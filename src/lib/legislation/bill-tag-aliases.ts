/**
 * Maps legacy bill issue_slugs (from older tag runs) to current catalog slugs.
 * Used when scoring votes so ingested tags still match user priorities.
 */
const LEGACY_BILL_TAG_ALIASES: Record<string, readonly string[]> = {
  "economy-jobs": ["jobs-labor-rights", "small-business"],
  "tax-policy": ["tax-relief"],
  immigration: ["border-security"],
  "gun-policy": ["gun-rights", "gun-regulation"],
  "tech-privacy": ["science-technology", "tech-regulation"],
  infrastructure: ["infrastructure-transportation"],
  "criminal-justice": ["criminal-justice-reform", "crime-prevention"],
};

/** Expand bill tags with legacy aliases for preference matching. */
export function expandBillTagsForMatching(slugs: string[]): string[] {
  const expanded = new Set<string>();
  for (const slug of slugs) {
    expanded.add(slug);
    for (const alias of LEGACY_BILL_TAG_ALIASES[slug] ?? []) {
      expanded.add(alias);
    }
  }
  return [...expanded];
}
