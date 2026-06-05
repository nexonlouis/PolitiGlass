/**
 * Chooses the issue slug used to weight a vote against user priorities.
 * Prefers overlap between bill tags and user-selected tags.
 */
export function pickIssueSlug(
  billIssueSlugs: string[] | null | undefined,
  userTags: string[],
): string {
  const billTags = billIssueSlugs ?? [];
  if (billTags.length > 0 && userTags.length > 0) {
    const overlap = billTags.find((s) => userTags.includes(s));
    if (overlap) return overlap;
  }
  if (billTags.length > 0) return billTags[0];
  if (userTags.length > 0) return userTags[0];
  return "general";
}
