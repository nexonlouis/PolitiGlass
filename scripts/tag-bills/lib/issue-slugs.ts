import { ISSUE_TAG_SLUGS, ISSUE_TAGS } from "../../../src/lib/constants/issue-tags.js";

/** Re-exported from app constants — single source of truth. */
export const ALLOWED_ISSUE_SLUGS = ISSUE_TAG_SLUGS;

export type IssueSlug = (typeof ISSUE_TAGS)[number]["slug"];

const ALLOWED_SET = new Set<string>(ALLOWED_ISSUE_SLUGS);

export function filterAllowedSlugs(slugs: string[]): IssueSlug[] {
  const out: IssueSlug[] = [];
  for (const slug of slugs) {
    if (ALLOWED_SET.has(slug) && !out.includes(slug as IssueSlug)) {
      out.push(slug as IssueSlug);
    }
  }
  return out;
}
