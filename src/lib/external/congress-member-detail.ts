const CONGRESS_API = "https://api.congress.gov/v3";
const LEGISLATORS_URL =
  "https://unitedstates.github.io/congress-legislators/legislators-current.json";

export interface CongressLegislatorRecord {
  id?: {
    bioguide?: string;
    wikipedia?: string;
  };
  name?: {
    first?: string;
    middle?: string;
    last?: string;
    official_full?: string;
  };
  bio?: {
    birthday?: string;
    gender?: string;
  };
  terms?: Array<{
    type?: string;
    start?: string;
    end?: string;
    state?: string;
    district?: number;
    party?: string;
    url?: string;
    phone?: string;
    address?: string;
  }>;
}

interface CongressGovMember {
  bioguideId?: string;
  name?: string;
  directOrderName?: string;
  partyName?: string;
  state?: string;
  district?: number;
  birthYear?: string;
  officialWebsiteUrl?: string;
  depiction?: { imageUrl?: string };
  terms?: {
    item?:
      | Array<{
          chamber?: string;
          startYear?: number;
          endYear?: number;
          stateCode?: string;
          district?: number;
        }>
      | {
          chamber?: string;
          startYear?: number;
          endYear?: number;
          stateCode?: string;
          district?: number;
        };
  };
}

let legislatorsCache: CongressLegislatorRecord[] | null = null;

async function loadLegislatorsCurrent(): Promise<CongressLegislatorRecord[]> {
  if (legislatorsCache) return legislatorsCache;

  const res = await fetch(LEGISLATORS_URL, { next: { revalidate: 86_400 } });
  if (!res.ok) return [];

  legislatorsCache = (await res.json()) as CongressLegislatorRecord[];
  return legislatorsCache;
}

export async function findLegislatorByBioguide(
  bioguideId: string,
): Promise<CongressLegislatorRecord | null> {
  const legislators = await loadLegislatorsCurrent();
  const normalized = bioguideId.toUpperCase();
  return (
    legislators.find((leg) => leg.id?.bioguide?.toUpperCase() === normalized) ?? null
  );
}

export async function fetchCongressGovMember(
  bioguideId: string,
): Promise<CongressGovMember | null> {
  const apiKey = process.env.CONGRESS_GOV_API_KEY;
  if (!apiKey) return null;

  const url = new URL(`${CONGRESS_API}/member/${encodeURIComponent(bioguideId)}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("api_key", apiKey);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 86_400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { member?: CongressGovMember };
    return data.member ?? null;
  } catch {
    return null;
  }
}

export function formatLegislatorName(
  record: CongressLegislatorRecord,
  fallback?: string | null,
): string {
  if (record.name?.official_full) return record.name.official_full;
  const parts = [record.name?.first, record.name?.middle, record.name?.last].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return fallback?.trim() || "Unknown";
}

export function latestLegislatorTerm(record: CongressLegislatorRecord) {
  const terms = record.terms ?? [];
  return terms.length > 0 ? terms[terms.length - 1] : undefined;
}
