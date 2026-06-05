/**
 * Determines whether a roll-call vote is relevant for reflection scoring.
 * Procedural votes (chamber rules, previous question, etc.) are ingested but
 * excluded from alignment scoring — they rarely reflect policy priorities.
 */

const EXCLUDED_CATEGORIES = new Set([
  "procedural",
  "quorum",
  "leadership",
  "recommit",
]);

/** Question prefixes/patterns for process votes (even when category is "passage"). */
const PROCEDURAL_QUESTION_PATTERNS: RegExp[] = [
  /^on motion to adjourn/i,
  /^on ordering the previous question/i,
  /^on motion to recommit:/i,
  /^on motion to discharge:/i,
  /^on motion to table/i,
  /^on agreeing to the resolution:\s*h\.?\ res\.? \d+ providing for consideration/i,
  /^on agreeing to the resolution:.*providing for consideration of the bill/i,
  /^on agreeing to the resolution:.*providing for consideration of the bills/i,
  /providing for disposition of the senate amendment/i,
  /^on waiving.*clause.*rule/i,
  /^on motion to proceed/i,
];

export interface VoteScoringInput {
  category?: string | null;
  question?: string | null;
}

export function isScoringRelevantVote(input: VoteScoringInput): boolean {
  const category = (input.category ?? "unknown").toLowerCase();
  if (EXCLUDED_CATEGORIES.has(category)) return false;

  const question = (input.question ?? "").trim();
  if (!question) return true;

  for (const pattern of PROCEDURAL_QUESTION_PATTERNS) {
    if (pattern.test(question)) return false;
  }

  return true;
}
