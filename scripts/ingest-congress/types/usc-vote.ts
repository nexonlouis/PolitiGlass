/** unitedstates/congress vote data.json — https://github.com/unitedstates/congress/wiki/Votes */

export interface UscVoteBillRef {
  type: string;
  number: number;
  congress: number;
}

export interface UscVoteMember {
  id: string;
  display_name?: string;
  party?: string;
  state?: string;
}

export type UscVotePositionKey =
  | "Yea"
  | "Nay"
  | "Not Voting"
  | "Present"
  | "Present, Voting";

export interface UscVoteFile {
  vote_id: string;
  chamber: "h" | "s";
  congress: number;
  session: string;
  number: number;
  date: string;
  updated_at?: string;
  source_url?: string;
  question?: string;
  type?: string;
  category?: string;
  result?: string;
  result_text?: string;
  requires?: string;
  bill?: UscVoteBillRef;
  amendment?: Record<string, unknown>;
  votes?: Partial<Record<UscVotePositionKey, UscVoteMember[]>>;
}
