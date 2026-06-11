import type { IssueStance } from "@/lib/types/issue-tags";
import type { ReflectionScoreResult, VoteAlignmentItem } from "@/lib/types";

export interface MemberVoteRecord {
  voteId: string;
  billId: string;
  title: string;
  summary: string | null;
  voteContext: string | null;
  question: string | null;
  votedAt: string;
  issueSlug: string;
  userStance: IssueStance;
  vote: "Yea" | "Nay" | "Not Voting" | "Present";
  userSupportsBill: boolean;
}

export interface ComputeReflectionScoreOptions {
  /** Include every analyzed vote in the result (for evidence UI). */
  includeAllVotes?: boolean;
}

/**
 * Weighted alignment → 0–100 score (50 = neutral / insufficient data).
 */
export function computeReflectionScore(
  votes: MemberVoteRecord[],
  tagWeights: Record<string, number>,
  options: ComputeReflectionScoreOptions = {},
): ReflectionScoreResult {
  if (votes.length === 0) {
    return {
      score: 50,
      confidence: "low",
      votesAnalyzed: 0,
      message: "Early reflection — add issue tags and wait for vote data.",
      aligned: [],
      diverged: [],
      scoredVotes: [],
    };
  }

  let weightedSum = 0;
  let weightTotal = 0;
  const items: VoteAlignmentItem[] = [];

  for (const v of votes) {
    const effectiveWeight = tagWeights[v.issueSlug] ?? 3;

    if (v.vote === "Not Voting" || v.vote === "Present") {
      continue;
    }

    const repSupports = v.vote === "Yea";
    const aligned =
      (v.userSupportsBill && repSupports) || (!v.userSupportsBill && !repSupports);

    const alignmentValue = aligned ? 1 : -1;
    weightedSum += alignmentValue * effectiveWeight;
    weightTotal += effectiveWeight;

    items.push({
      voteId: v.voteId,
      billId: v.billId,
      title: v.title,
      summary: v.summary,
      voteContext: v.voteContext,
      question: v.question,
      votedAt: v.votedAt,
      vote: v.vote,
      issueSlug: v.issueSlug,
      userStance: v.userStance,
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
      scoredVotes: [],
    };
  }

  const raw = weightedSum / weightTotal;
  const score = Math.round(Math.min(100, Math.max(0, 50 + raw * 50)));

  const confidence =
    items.length < 5 ? "low" : items.length < 16 ? "moderate" : "strong";

  const alignedItems = items.filter((i) => i.aligned).slice(0, 3);
  const divergedItems = items.filter((i) => !i.aligned).slice(0, 3);

  return {
    score,
    confidence,
    votesAnalyzed: items.length,
    message: `Based on ${items.length} votes across your priority issues.`,
    aligned: alignedItems,
    diverged: divergedItems,
    scoredVotes: options.includeAllVotes ? items : undefined,
  };
}
