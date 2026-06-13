import type { IssueStance } from "@/lib/types/issue-tags";

type RollCallVote = "Yea" | "Nay" | "Not Voting" | "Present";

/** Whether the user's position on the bill matches wanting the rep's roll-call vote. */
export function alignedFromUserSupports(
  userSupportsBill: boolean,
  repVote: RollCallVote,
): boolean {
  const repSupports = repVote === "Yea";
  return (userSupportsBill && repSupports) || (!userSupportsBill && !repSupports);
}

/** Stance on this bill implied by effective alignment + how the rep voted. */
export function effectiveStanceFromAlignment(
  aligned: boolean,
  repVote: RollCallVote,
): IssueStance {
  if (repVote !== "Yea" && repVote !== "Nay") {
    return "support";
  }
  const repSupports = repVote === "Yea";
  const userSupportsBill = repSupports ? aligned : !aligned;
  return userSupportsBill ? "support" : "oppose";
}
