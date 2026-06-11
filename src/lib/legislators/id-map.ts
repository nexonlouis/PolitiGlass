/**
 * unitedstates/congress Senate roll calls identify members by LIS ID, not Bioguide.
 * House roll calls use Bioguide IDs. See congress-legislators `id.lis` field.
 */

const LEGISLATORS_URL =
  "https://unitedstates.github.io/congress-legislators/legislators-current.json";

export interface LegislatorIdMaps {
  bioguideToLis: Map<string, string>;
  lisToBioguide: Map<string, string>;
}

let cachedMaps: LegislatorIdMaps | null = null;

type LegislatorRecord = {
  id?: { bioguide?: string; lis?: string };
};

export async function loadLegislatorIdMaps(): Promise<LegislatorIdMaps> {
  if (cachedMaps) return cachedMaps;

  const response = await fetch(LEGISLATORS_URL, {
    next: { revalidate: 86_400 },
  });

  if (!response.ok) {
    throw new Error(`Failed to load legislator IDs (${response.status})`);
  }

  const legislators = (await response.json()) as LegislatorRecord[];
  const bioguideToLis = new Map<string, string>();
  const lisToBioguide = new Map<string, string>();

  for (const leg of legislators) {
    const bioguide = leg.id?.bioguide?.toUpperCase();
    const lis = leg.id?.lis?.toUpperCase();
    if (!bioguide || !lis) continue;
    bioguideToLis.set(bioguide, lis);
    lisToBioguide.set(lis, bioguide);
  }

  cachedMaps = { bioguideToLis, lisToBioguide };
  return cachedMaps;
}

/** IDs that may appear in roll_call_positions for a member (Bioguide + Senate LIS). */
export async function memberVoteLookupIds(bioguideId: string): Promise<string[]> {
  const normalized = bioguideId.toUpperCase();
  try {
    const { bioguideToLis } = await loadLegislatorIdMaps();
    const lis = bioguideToLis.get(normalized);
    return lis ? [normalized, lis] : [normalized];
  } catch (error) {
    console.error("legislator id map unavailable", error);
    return [normalized];
  }
}
