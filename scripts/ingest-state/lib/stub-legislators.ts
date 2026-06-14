import type { LegislatorRow } from "./normalize.js";

export function buildVoteChamberMap(
  votes: Array<{ vote_id: string; chamber: "lower" | "upper" }>,
): Map<string, "lower" | "upper"> {
  return new Map(votes.map((v) => [v.vote_id, v.chamber]));
}

/**
 * Legislator rows for voter_ids in vote_people that are not in the current roster.
 * Chamber is inferred from which chamber's votes they appear on most often.
 */
export function buildStubLegislators(
  positionRows: Record<string, string>[],
  voteChamberById: Map<string, "lower" | "upper">,
  knownPersonIds: ReadonlySet<string>,
  stateAbbr: string,
): LegislatorRow[] {
  const state = stateAbbr.toUpperCase();
  const byPerson = new Map<
    string,
    { name: string; lower: number; upper: number }
  >();

  for (const row of positionRows) {
    const personId = row.voter_id?.trim();
    if (!personId || knownPersonIds.has(personId)) continue;

    const name = row.voter_name?.trim() || personId;
    let entry = byPerson.get(personId);
    if (!entry) {
      entry = { name, lower: 0, upper: 0 };
      byPerson.set(personId, entry);
    } else if (name.length > entry.name.length) {
      entry.name = name;
    }

    const voteId = row.vote_event_id?.trim();
    const chamber = voteId ? voteChamberById.get(voteId) : undefined;
    if (chamber === "lower") entry.lower += 1;
    else if (chamber === "upper") entry.upper += 1;
  }

  const stubs: LegislatorRow[] = [];

  for (const [personId, info] of byPerson) {
    const chamber: "lower" | "upper" =
      info.upper > info.lower ? "upper" : "lower";
    const nameParts = info.name.split(/\s+/).filter(Boolean);

    stubs.push({
      person_id: personId,
      state,
      name: info.name,
      given_name: nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : null,
      family_name: nameParts.length > 1 ? nameParts[nameParts.length - 1]! : info.name,
      party: null,
      chamber,
      district: null,
      image_url: null,
      email: null,
    });
  }

  stubs.sort((a, b) => a.name.localeCompare(b.name));
  return stubs;
}
