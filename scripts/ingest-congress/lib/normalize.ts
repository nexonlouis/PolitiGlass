import { isScoringRelevantVote } from "../../../src/lib/legislation/vote-scoring.js";
import type { UscBillFile } from "../types/usc-bill.js";
import type { UscVoteFile, UscVoteMember, UscVotePositionKey } from "../types/usc-vote.js";

export function formatBillId(parts: {
  type: string;
  number: number;
  congress: number;
}): string {
  const type = parts.type.toLowerCase().replace(/\s+/g, "");
  return `${type}${parts.number}-${parts.congress}`;
}

export function chamberFromUsc(ch: "h" | "s"): "house" | "senate" {
  return ch === "h" ? "house" : "senate";
}

const POSITION_MAP: Record<string, string> = {
  Yea: "Yea",
  Nay: "Nay",
  "Not Voting": "Not Voting",
  Present: "Present",
  "Present, Voting": "Present, Voting",
};

export function normalizePosition(raw: string): string | null {
  return POSITION_MAP[raw] ?? null;
}

export function flattenVotePositions(
  votes: UscVoteFile["votes"],
): Array<{ bioguideId: string; position: string; party: string | null; state: string | null }> {
  const out: Array<{
    bioguideId: string;
    position: string;
    party: string | null;
    state: string | null;
  }> = [];

  if (!votes) return out;

  for (const [positionKey, members] of Object.entries(votes)) {
    const position = normalizePosition(positionKey);
    if (!position || !Array.isArray(members)) continue;

    for (const m of members as UscVoteMember[]) {
      if (!m.id) continue;
      out.push({
        bioguideId: m.id.toUpperCase(),
        position,
        party: m.party ?? null,
        state: m.state ?? null,
      });
    }
  }

  return out;
}

export function normalizeVoteRow(v: UscVoteFile) {
  const relatedBillId = v.bill
    ? formatBillId({
        type: v.bill.type,
        number: v.bill.number,
        congress: v.bill.congress,
      })
    : null;

  const category = v.category ?? "unknown";
  const question = v.question ?? null;

  return {
    vote_id: v.vote_id,
    congress: v.congress,
    session: v.session,
    chamber: chamberFromUsc(v.chamber),
    roll_number: v.number,
    voted_at: new Date(v.date).toISOString(),
    question,
    vote_type: v.type ?? null,
    category,
    result: v.result ?? v.result_text ?? null,
    requires_threshold: v.requires ?? null,
    source_url: v.source_url ?? null,
    related_bill_id: relatedBillId,
    scoring_relevant: isScoringRelevantVote({ category, question }),
    source_updated_at: v.updated_at ? new Date(v.updated_at).toISOString() : null,
  };
}

export function normalizeBillRow(b: UscBillFile) {
  const billId =
    b.bill_id ??
    formatBillId({ type: b.bill_type, number: b.number, congress: b.congress });

  const title =
    b.titles?.find((t) => t.type === "official" || t.type === "short")?.title ??
    b.titles?.[0]?.title ??
    null;

  const subjects: string[] = [];
  if (b.subjects) {
    for (const s of b.subjects) {
      if (typeof s === "string") subjects.push(s);
      else if (s && typeof s === "object" && "name" in s) subjects.push(s.name);
    }
  }

  return {
    bill_id: billId,
    congress: b.congress,
    bill_type: b.bill_type.toLowerCase(),
    bill_number: b.number,
    title,
    short_title: b.titles?.find((t) => t.type === "short")?.title ?? null,
    summary: b.summary?.text ?? null,
    subjects,
    // issue_slugs intentionally omitted — preserved on upsert; use scripts/tag-bills
    introduced_on: b.introduced_at?.slice(0, 10) ?? null,
    source_updated_at: b.updated_at ? new Date(b.updated_at).toISOString() : null,
  };
}
