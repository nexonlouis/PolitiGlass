import type { DemographicsInput } from "@/lib/types";

const BASE_SUGGESTIONS = [
  "healthcare",
  "economy-jobs",
  "housing-affordability",
  "infrastructure",
  "civil-rights",
  "foreign-policy",
  "national-security",
];

/**
 * Ranks issue tag slugs from demographics. Used only for suggestions — never for scoring.
 */
export function suggestIssueTags(input: DemographicsInput): string[] {
  const scores = new Map<string, number>();

  for (const slug of BASE_SUGGESTIONS) {
    scores.set(slug, 1);
  }

  const birthYear = input.birthYear;
  if (birthYear) {
    const age = new Date().getFullYear() - birthYear;
    if (age >= 18 && age <= 29) {
      bump(scores, "student-loans", 4);
      bump(scores, "housing-affordability", 3);
    }
    if (age >= 55) {
      bump(scores, "retirement-security", 4);
      bump(scores, "healthcare", 3);
    }
  }

  if (input.hasChildren === true) {
    bump(scores, "public-schools", 5);
    bump(scores, "childcare", 4);
    bump(scores, "tax-policy", 2);
  }

  if (input.incomeBracket && input.incomeBracket !== "prefer_not_to_say") {
    if (input.incomeBracket === "under_25k" || input.incomeBracket === "25k_50k") {
      bump(scores, "healthcare", 3);
      bump(scores, "economy-jobs", 3);
    }
    if (input.incomeBracket === "100k_150k" || input.incomeBracket === "over_150k") {
      bump(scores, "tax-policy", 4);
    }
  }

  if (input.educationLevel === "graduate" || input.educationLevel === "bachelors") {
    bump(scores, "tech-privacy", 2);
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => slug)
    .slice(0, 8);
}

function bump(scores: Map<string, number>, slug: string, amount: number) {
  scores.set(slug, (scores.get(slug) ?? 0) + amount);
}
