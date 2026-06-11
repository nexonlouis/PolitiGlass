export type IssueStance = "support" | "oppose";

export interface IssueTagPreference {
  slug: string;
  weight: number;
  stance: IssueStance;
}
