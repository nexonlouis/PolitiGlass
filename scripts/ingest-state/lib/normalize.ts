import { isStateScoringRelevantVote } from "../../../src/lib/legislation/state-vote-scoring.js";
import {
  chamberFromClassification,
  normalizeStatePosition,
  parseListField,
} from "./zip-csv.js";

export interface PeopleJsonFile {
  state: string;
  people: Array<{
    id: string;
    name: string;
    party?: string;
    given_name?: string;
    family_name?: string;
    image?: string;
    email?: string;
    current_role?: {
      org_classification?: string;
      district?: string;
    };
  }>;
}

export interface LegislatorRow {
  person_id: string;
  state: string;
  name: string;
  given_name: string | null;
  family_name: string | null;
  party: string | null;
  chamber: "lower" | "upper";
  district: string | null;
  image_url: string | null;
  email: string | null;
}

export function normalizeLegislatorRow(
  person: PeopleJsonFile["people"][0],
  stateAbbr: string,
): LegislatorRow | null {
  const chamber = chamberFromClassification(person.current_role?.org_classification);
  if (!chamber) return null;

  return {
    person_id: person.id,
    state: stateAbbr.toUpperCase(),
    name: person.name,
    given_name: person.given_name ?? null,
    family_name: person.family_name ?? null,
    party: person.party ?? null,
    chamber,
    district: person.current_role?.district ?? null,
    image_url: person.image ?? null,
    email: person.email ?? null,
  };
}

export function normalizeBillRow(
  row: Record<string, string>,
  summaryByBillId: Map<string, string>,
  stateAbbr: string,
) {
  const billId = row.id?.trim();
  if (!billId) return null;

  return {
    bill_id: billId,
    state: stateAbbr.toUpperCase(),
    session: row.session_identifier?.trim() ?? "",
    identifier: row.identifier?.trim() ?? "",
    title: row.title?.trim() || null,
    summary: summaryByBillId.get(billId) ?? null,
    subjects: parseListField(row.subject),
    issue_slugs: [] as string[],
    chamber: chamberFromClassification(row.organization_classification),
  };
}

export function buildOrganizationChamberMap(
  rows: Record<string, string>[],
): Map<string, "lower" | "upper"> {
  const map = new Map<string, "lower" | "upper">();

  for (const row of rows) {
    const id = row.id?.trim();
    const classification = chamberFromClassification(row.classification);
    if (id && classification) {
      map.set(id, classification);
    }
  }

  return map;
}

export function inferVoteChamber(
  organizationId: string | undefined,
  billChamber: "lower" | "upper" | null,
  orgChamber: Map<string, "lower" | "upper">,
): "lower" | "upper" {
  if (organizationId) {
    const direct = orgChamber.get(organizationId);
    if (direct) return direct;
  }
  if (billChamber) return billChamber;
  return "lower";
}

export function normalizeVoteRow(
  row: Record<string, string>,
  stateAbbr: string,
  billChamberById: Map<string, "lower" | "upper" | null>,
  orgChamber: Map<string, "lower" | "upper">,
) {
  const voteId = row.id?.trim();
  if (!voteId) return null;

  const motionClassification = parseListField(row.motion_classification);
  const motionText = row.motion_text?.trim() || null;
  const billId = row.bill_id?.trim() || null;
  const billChamber = billId ? (billChamberById.get(billId) ?? null) : null;

  return {
    vote_id: voteId,
    state: stateAbbr.toUpperCase(),
    session: row.session_identifier?.trim() ?? "",
    chamber: inferVoteChamber(row.organization_id, billChamber, orgChamber),
    voted_at: new Date(row.start_date).toISOString(),
    motion_text: motionText,
    motion_classification: motionClassification,
    result: row.result?.trim() || null,
    related_bill_id: billId,
    organization_id: row.organization_id?.trim() || null,
    scoring_relevant: isStateScoringRelevantVote({ motionClassification, motionText }),
  };
}

export function normalizePositionRow(
  row: Record<string, string>,
  partyByPersonId: Map<string, string | null>,
) {
  const voteId = row.vote_event_id?.trim();
  const personId = row.voter_id?.trim();
  if (!voteId || !personId) return null;

  const position = normalizeStatePosition(row.option ?? "");
  if (!position) return null;

  return {
    vote_id: voteId,
    person_id: personId,
    position,
    party: partyByPersonId.get(personId) ?? null,
  };
}

export interface PositionRow {
  vote_id: string;
  person_id: string;
  position: string;
  party: string | null;
}

const POSITION_PRIORITY: Record<string, number> = {
  Yea: 4,
  Nay: 3,
  Present: 2,
  "Not Voting": 1,
};

/** Merge duplicate (vote_id, person_id) rows — common in GA bulk exports. */
export function dedupePositionRows(positions: PositionRow[]): PositionRow[] {
  const byKey = new Map<string, PositionRow[]>();

  for (const row of positions) {
    const key = `${row.vote_id}\0${row.person_id}`;
    const group = byKey.get(key);
    if (group) group.push(row);
    else byKey.set(key, [row]);
  }

  const deduped: PositionRow[] = [];
  for (const group of byKey.values()) {
    deduped.push(group.length === 1 ? group[0]! : pickBestPositionRow(group));
  }

  return deduped;
}

function pickBestPositionRow(group: PositionRow[]): PositionRow {
  const counts = new Map<string, number>();
  for (const row of group) {
    counts.set(row.position, (counts.get(row.position) ?? 0) + 1);
  }

  let bestPosition = group[0]!.position;
  let bestScore = -1;
  for (const [position, count] of counts) {
    const score = count * 10 + (POSITION_PRIORITY[position] ?? 0);
    if (score > bestScore) {
      bestScore = score;
      bestPosition = position;
    }
  }

  const template = group.find((row) => row.position === bestPosition) ?? group[0]!;
  return { ...template, position: bestPosition };
}

export function buildSummaryMap(rows: Record<string, string>[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const billId = row.bill_id?.trim();
    const abstract = row.abstract?.trim();
    if (billId && abstract && !map.has(billId)) {
      map.set(billId, abstract);
    }
  }
  return map;
}

export function buildBillChamberMap(
  bills: Array<{ bill_id: string; chamber: "lower" | "upper" | null }>,
): Map<string, "lower" | "upper" | null> {
  return new Map(bills.map((b) => [b.bill_id, b.chamber]));
}

export function buildPartyMap(
  legislators: Array<{ person_id: string; party: string | null }>,
): Map<string, string | null> {
  return new Map(legislators.map((l) => [l.person_id, l.party]));
}

export function legislatorPersonIdSet(
  legislators: Array<{ person_id: string }>,
): Set<string> {
  return new Set(legislators.map((l) => l.person_id));
}
