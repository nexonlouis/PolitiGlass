import type { MemberVoteRecord } from "@/lib/legislation/reflection-score";
import { pickIssueSlug } from "@/lib/legislation/pick-issue-slug";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export interface MemberVoteRow {
  bioguide_id: string;
  position: string;
  vote_id: string;
  voted_at: string;
  chamber: string;
  category: string | null;
  question: string | null;
  result: string | null;
  related_bill_id: string | null;
  bill_title: string | null;
  bill_issue_slugs: string[] | null;
  category_weight: number | null;
  scoring_relevant: boolean | null;
}

export interface FetchMemberVotesOptions {
  limit?: number;
  userTags?: string[];
  /** Include procedural/process votes (default false). */
  includeProcedural?: boolean;
}

async function getLegislationClient() {
  const service = await createServiceClient();
  if (service) return service;
  return createClient();
}

function normalizePosition(raw: string): MemberVoteRecord["vote"] | null {
  if (raw === "Yea" || raw === "Nay" || raw === "Not Voting" || raw === "Present") {
    return raw;
  }
  if (raw === "Present, Voting") return "Present";
  return null;
}

function mapRowToMemberVoteRecord(
  row: MemberVoteRow,
  userTags: string[],
): MemberVoteRecord | null {
  const vote = normalizePosition(row.position);
  if (!vote) return null;

  const billId = row.related_bill_id ?? row.vote_id;
  const title =
    row.bill_title ??
    row.question ??
    `Roll call ${row.vote_id}`;

  return {
    billId,
    title,
    issueSlug: pickIssueSlug(row.bill_issue_slugs, userTags),
    vote,
    userSupportsBill: true,
  };
}

/**
 * Fetches roll-call votes for a member from ingested Supabase data.
 */
export async function fetchMemberVotesFromDb(
  bioguideId: string,
  options: FetchMemberVotesOptions = {},
): Promise<MemberVoteRecord[]> {
  const limit = options.limit ?? 25;
  const userTags = options.userTags ?? [];
  const supabase = await getLegislationClient();

  let query = supabase
    .from("member_votes_enriched")
    .select(
      "bioguide_id, position, vote_id, voted_at, chamber, category, question, result, related_bill_id, bill_title, bill_issue_slugs, category_weight, scoring_relevant",
    )
    .eq("bioguide_id", bioguideId.toUpperCase())
    .order("voted_at", { ascending: false });

  if (!options.includeProcedural) {
    query = query.eq("scoring_relevant", true);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("member_votes_enriched query failed", error.message);
    return [];
  }

  const records: MemberVoteRecord[] = [];
  for (const row of (data ?? []) as MemberVoteRow[]) {
    const mapped = mapRowToMemberVoteRecord(row, userTags);
    if (mapped) records.push(mapped);
  }

  return records;
}

export async function countMemberVotesInDb(bioguideId: string): Promise<number> {
  const supabase = await getLegislationClient();
  const { count, error } = await supabase
    .from("roll_call_positions")
    .select("*", { count: "exact", head: true })
    .eq("bioguide_id", bioguideId.toUpperCase());

  if (error) return 0;
  return count ?? 0;
}
