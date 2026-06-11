import type { MemberVoteRecord } from "@/lib/legislation/reflection-score";

const CONGRESS_API = "https://api.congress.gov/v3";

interface HouseVoteMember {
  bioguideId?: string;
  fullName?: string;
  vote?: string;
}

/**
 * Fetches recent House roll-call member votes for a bioguide ID.
 * Senate votes are not available on Congress.gov API — returns [] for senators.
 */
export async function fetchHouseVotesForMember(
  bioguideId: string,
  congress = 119,
  limit = 10,
): Promise<MemberVoteRecord[]> {
  const apiKey = process.env.CONGRESS_GOV_API_KEY;
  if (!apiKey) return [];

  const listUrl = `${CONGRESS_API}/house-vote/${congress}?format=json&limit=${limit}&api_key=${apiKey}`;

  try {
    const listRes = await fetch(listUrl, { next: { revalidate: 3600 } });
    if (!listRes.ok) return [];

    const listData = (await listRes.json()) as {
      houseRollCallVotes?: Array<{
        rollCallNumber: number;
        sessionNumber: number;
        legislationNumber?: string;
        legislationTitle?: string;
      }>;
    };

    const votes = listData.houseRollCallVotes ?? [];
    const records: MemberVoteRecord[] = [];

    for (const vote of votes.slice(0, limit)) {
      const session = vote.sessionNumber ?? 1;
      const rollCall = vote.rollCallNumber;
      const membersUrl = `${CONGRESS_API}/house-vote/${congress}/${session}/${rollCall}/members?format=json&api_key=${apiKey}`;
      const membersRes = await fetch(membersUrl, { next: { revalidate: 3600 } });
      if (!membersRes.ok) continue;

      const membersData = (await membersRes.json()) as {
        members?: HouseVoteMember[];
      };

      const member = membersData.members?.find(
        (m) => m.bioguideId?.toUpperCase() === bioguideId.toUpperCase(),
      );
      if (!member?.vote) continue;

      const normalized = normalizeVote(member.vote);
      if (!normalized) continue;

      records.push({
        voteId: `house-${congress}-${session}-${rollCall}`,
        billId: vote.legislationNumber ?? `vote-${rollCall}`,
        title: vote.legislationTitle ?? `Roll call ${rollCall}`,
        summary: null,
        voteContext: null,
        question: null,
        votedAt: new Date().toISOString(),
        issueSlug: "healthcare",
        userStance: "support",
        vote: normalized,
        userSupportsBill: true,
      });
    }

    return records;
  } catch (err) {
    console.error("Congress.gov fetch failed", err);
    return [];
  }
}

function normalizeVote(
  raw: string,
): MemberVoteRecord["vote"] | null {
  const v = raw.toLowerCase();
  if (v.includes("yea") || v === "yes") return "Yea";
  if (v.includes("nay") || v === "no") return "Nay";
  if (v.includes("not")) return "Not Voting";
  if (v.includes("present")) return "Present";
  return null;
}
