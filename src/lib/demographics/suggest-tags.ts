import { ISSUE_TAGS } from "@/lib/constants/issue-tags";
import type { DemographicsInput } from "@/lib/types";

/** Base popularity from catalog order (earlier = higher). */
function basePopularityScores(): Map<string, number> {
  const scores = new Map<string, number>();
  const max = ISSUE_TAGS.length;
  ISSUE_TAGS.forEach((tag, index) => {
    scores.set(tag.slug, max - index);
  });
  return scores;
}

function bump(scores: Map<string, number>, slug: string, amount: number) {
  if (!ISSUE_TAGS.some((t) => t.slug === slug)) return;
  scores.set(slug, (scores.get(slug) ?? 0) + amount);
}

/**
 * Scores every issue slug from demographics + default popularity.
 * Used to sort the tag picker and badge “suggested for you” tags.
 */
export function rankTagsByDemographics(input: DemographicsInput): Map<string, number> {
  const scores = basePopularityScores();

  const birthYear = input.birthYear;
  if (birthYear) {
    const age = new Date().getFullYear() - birthYear;
    if (age >= 18 && age <= 29) {
      bump(scores, "student-loans", 8);
      bump(scores, "housing-affordability", 6);
      bump(scores, "jobs-labor-rights", 4);
    }
    if (age >= 55) {
      bump(scores, "healthcare", 8);
      bump(scores, "poverty", 4);
    }
  }

  if (input.hasChildren === true) {
    bump(scores, "public-schools", 10);
    bump(scores, "childcare", 8);
  }

  if (input.educationLevel && input.educationLevel !== "prefer_not_to_say") {
    if (input.educationLevel === "high_school" || input.educationLevel === "some_college") {
      bump(scores, "training-programs", 5);
      bump(scores, "jobs-labor-rights", 4);
    }
    if (input.educationLevel === "bachelors" || input.educationLevel === "graduate") {
      bump(scores, "science-technology", 5);
      bump(scores, "tech-regulation", 4);
      bump(scores, "student-loans", 3);
    }
  }

  if (input.incomeBracket && input.incomeBracket !== "prefer_not_to_say") {
    if (input.incomeBracket === "under_25k" || input.incomeBracket === "25k_50k") {
      bump(scores, "healthcare", 6);
      bump(scores, "poverty", 6);
      bump(scores, "housing-affordability", 5);
      bump(scores, "jobs-labor-rights", 4);
    }
    if (input.incomeBracket === "50k_100k") {
      bump(scores, "tax-relief", 3);
      bump(scores, "housing-affordability", 3);
    }
    if (input.incomeBracket === "100k_150k" || input.incomeBracket === "over_150k") {
      bump(scores, "tax-relief", 8);
      bump(scores, "less-government-spending", 6);
      bump(scores, "small-business", 5);
      bump(scores, "deregulation", 4);
    }
  }

  return scores;
}

/** Top slugs for API / preselect (demographics + default popularity). */
export function suggestIssueTags(input: DemographicsInput): string[] {
  const scores = rankTagsByDemographics(input);
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([slug]) => slug);
}
