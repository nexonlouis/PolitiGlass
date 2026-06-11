import type { MemberVoteRecord } from "@/lib/legislation/reflection-score";
import { pickIssueMatch } from "@/lib/legislation/pick-issue-match";
import { pickIssueSlug } from "@/lib/legislation/pick-issue-slug";
import type { IssueTagPreference } from "@/lib/types/issue-tags";
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
  bill_summary?: string | null;
  bill_issue_slugs: string[] | null;
  category_weight: number | null;
  scoring_relevant: boolean | null;
}

export interface FetchMemberVotesOptions {
  limit?: number;
  userTags?: string[];
  preferences?: IssueTagPreference[];
  /** Include procedural/process votes (default false). */
  includeProcedural?: boolean;
  /** Only votes matching user issue tags (reflection scoring). */
  scoringOnly?: boolean;
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

async function fetchBillSummaries(
  supabase: Awaited<ReturnType<typeof getLegislationClient>>,
  billIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (billIds.length === 0) return map;

  const chunkSize = 100;
  for (let i = 0; i < billIds.length; i += chunkSize) {
    const chunk = billIds.slice(i, i + chunkSize);
    const { data } = await supabase
      .from("bills")
      .select("bill_id, summary")
      .in("bill_id", chunk);

    for (const row of data ?? []) {
      map.set(row.bill_id, row.summary);
    }
  }

  return map;
}

function mapRowToMemberVoteRecord(
  row: MemberVoteRow,
  preferences: IssueTagPreference[],
  summaryByBill: Map<string, string | null>,
  scoringOnly: boolean,
): MemberVoteRecord | null {
  const vote = normalizePosition(row.position);
  if (!vote) return null;

  const match = pickIssueMatch(row.bill_issue_slugs, preferences);
  if (scoringOnly && !match) return null;

  const issueSlug =
    match?.issueSlug ??
    pickIssueSlug(row.bill_issue_slugs, preferences.map((p) => p.slug));
  const userStance = match?.userStance ?? "support";
  const billId = row.related_bill_id ?? row.vote_id;
  const title = row.bill_title ?? row.question ?? `Roll call ${row.vote_id}`;
  const summary =
    row.bill_summary ??
    (row.related_bill_id ? (summaryByBill.get(row.related_bill_id) ?? null) : null);

  return {
    voteId: row.vote_id,
    billId,
    title,
    summary,
    question: row.question,
    votedAt: row.voted_at,
    issueSlug,
    userStance,
    vote,
    userSupportsBill: userStance === "support",
  };
}

function resolvePreferences(options: FetchMemberVotesOptions): IssueTagPreference[] {
  if (options.preferences?.length) return options.preferences;
  return (options.userTags ?? []).map((slug) => ({
    slug,
    weight: 3,
    stance: "support" as const,
  }));
}

/**
 * Fetches roll-call votes for a member from ingested Supabase data.
 */
export async function fetchMemberVotesFromDb(
  bioguideId: string,
  options: FetchMemberVotesOptions = {},
): Promise<MemberVoteRecord[]> {
  const limit = options.limit ?? 25;
  const preferences = resolvePreferences(options);
  const scoringOnly = options.scoringOnly ?? false;
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

  const fetchLimit = scoringOnly ? Math.min(limit * 4, 200) : limit;
  const { data, error } = await query.limit(fetchLimit);

  if (error) {
    console.error("member_votes_enriched query failed", error.message);
    return [];
  }

  const rows = (data ?? []) as MemberVoteRow[];
  const billIds = [
    ...new Set(rows.map((r) => r.related_bill_id).filter((id): id is string => Boolean(id))),
  ];
  const summaryByBill = await fetchBillSummaries(supabase, billIds);

  const records: MemberVoteRecord[] = [];
  for (const row of rows) {
    const mapped = mapRowToMemberVoteRecord(
      row,
      preferences,
      summaryByBill,
      scoringOnly,
    );
    if (mapped) records.push(mapped);
    if (scoringOnly && records.length >= limit) break;
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
