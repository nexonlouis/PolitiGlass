import type { ReflectionScoreResult, VoteAlignmentItem } from "@/lib/types";

export interface MemberVoteRecord {
  billId: string;
  title: string;
  issueSlug: string;
  vote: "Yea" | "Nay" | "Not Voting" | "Present";
  userSupportsBill: boolean;
}

/**
 * Weighted alignment → 0–100 score (50 = neutral / insufficient data).
 */
export function computeReflectionScore(
  votes: MemberVoteRecord[],
  tagWeights: Record<string, number>,
): ReflectionScoreResult {
  if (votes.length === 0) {
    return {
      score: 50,
      confidence: "low",
      votesAnalyzed: 0,
      message: "Early reflection — add issue tags and wait for vote data.",
      aligned: [],
      diverged: [],
    };
  }

  let weightedSum = 0;
  let weightTotal = 0;
  const items: VoteAlignmentItem[] = [];

  for (const v of votes) {
    const weight = tagWeights[v.issueSlug] ?? 1;
    if (v.vote === "Not Voting" || v.vote === "Present") {
      continue;
    }

    const repSupports = v.vote === "Yea";
    const aligned =
      (v.userSupportsBill && repSupports) || (!v.userSupportsBill && !repSupports);

    const alignmentValue = aligned ? 1 : -1;
    weightedSum += alignmentValue * weight;
    weightTotal += weight;

    items.push({
      billId: v.billId,
      title: v.title,
      vote: v.vote,
      issueSlug: v.issueSlug,
      aligned,
    });
  }

  if (weightTotal === 0) {
    return {
      score: 50,
      confidence: "low",
      votesAnalyzed: 0,
      message: "No scored roll-call votes yet for your priorities.",
      aligned: [],
      diverged: [],
    };
  }

  const raw = weightedSum / weightTotal;
  const score = Math.round(Math.min(100, Math.max(0, 50 + raw * 50)));

  const confidence =
    votes.length < 5 ? "low" : votes.length < 16 ? "moderate" : "strong";

  const alignedItems = items.filter((i) => i.aligned).slice(0, 3);
  const divergedItems = items.filter((i) => !i.aligned).slice(0, 3);

  return {
    score,
    confidence,
    votesAnalyzed: items.length,
    message: `Based on ${items.length} votes across your priority issues.`,
    aligned: alignedItems,
    diverged: divergedItems,
  };
}
