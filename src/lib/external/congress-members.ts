import { parseUsAddress } from "@/lib/address/parse-us-address";
import { getCurrentCongress } from "@/lib/config/congress";
import { geocodeCongressionalDistrict } from "@/lib/external/census-geocoder";
import type { DistrictLookupResult, Representative } from "@/lib/types";

const CONGRESS_API = "https://api.congress.gov/v3";

interface CongressMember {
  bioguideId?: string;
  name?: string;
  partyName?: string;
  state?: string;
  district?: number;
  depiction?: { imageUrl?: string };
  terms?: {
    item?:
      | Array<{ chamber?: string; startYear?: number }>
      | { chamber?: string; startYear?: number };
  };
}

/**
 * Live federal lookup: Census geocoder → Congress.gov current members (119th).
 */
export async function lookupViaCongressGov(
  address: string,
): Promise<DistrictLookupResult | null> {
  const apiKey = process.env.CONGRESS_GOV_API_KEY;
  if (!apiKey) return null;

  const districtGeo = await geocodeCongressionalDistrict(address);
  const parsed = parseUsAddress(address);

  const stateCode = districtGeo?.stateCode ?? parsed?.state;
  if (!stateCode) return null;

  const districtNumber = districtGeo?.districtNumber;
  const congress = getCurrentCongress();
  const representatives: Representative[] = [];

  if (districtNumber) {
    const houseMembers = await fetchCongressMembers(
      `member/congress/${congress}/${stateCode}/${districtNumber}`,
      apiKey,
      { currentMember: true },
    );
    for (const m of houseMembers) {
      const rep = mapCongressMember(m, "house", stateCode, districtNumber);
      if (rep) representatives.push(rep);
    }
  }

  const delegation = await fetchCongressMembers(
    `member/congress/${congress}/${stateCode}`,
    apiKey,
    { currentMember: true },
  );

  for (const m of delegation) {
    if (!isSenator(m)) continue;
    const rep = mapCongressMember(m, "senate", stateCode, null);
    if (rep && !representatives.some((r) => r.bioguideId === rep.bioguideId)) {
      representatives.push(rep);
    }
  }

  if (representatives.length === 0) return null;

  const congressionalDistrict =
    districtNumber && stateCode ? `${stateCode}-${districtNumber}` : "unassigned";

  return {
    congressionalDistrict,
    state: stateCode,
    ocdDivisionId: null,
    lookupZip: districtGeo?.lookupZip ?? parsed?.zip ?? null,
    representatives,
    source: "congress.gov",
  };
}

async function fetchCongressMembers(
  path: string,
  apiKey: string,
  params: Record<string, string | boolean>,
): Promise<CongressMember[]> {
  const url = new URL(`${CONGRESS_API}/${path}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("limit", "250");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) {
    console.error("Congress.gov member error", res.status, path);
    return [];
  }

  const data = (await res.json()) as { members?: CongressMember[] };
  return data.members ?? [];
}

function isSenator(member: CongressMember): boolean {
  const terms = normalizeTerms(member.terms);
  return terms.some((t) => t.chamber?.includes("Senate"));
}

function normalizeTerms(
  terms: CongressMember["terms"],
): Array<{ chamber?: string; startYear?: number }> {
  const item = terms?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

function mapCongressMember(
  member: CongressMember,
  chamber: Representative["chamber"],
  stateCode: string,
  district: string | null,
): Representative | null {
  const bioguideId = member.bioguideId;
  const fullName = formatMemberName(member.name);
  if (!bioguideId || !fullName) return null;

  return {
    bioguideId,
    fullName,
    chamber,
    party: member.partyName ?? null,
    photoUrl: member.depiction?.imageUrl ?? null,
    state: stateCode,
    district: district ?? (member.district != null ? String(member.district) : null),
  };
}

function formatMemberName(name: string | undefined): string | null {
  if (!name) return null;
  const parts = name.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    return `${parts[1]} ${parts[0]}`.trim();
  }
  return name.trim();
}

/** Validates Congress.gov API key (members list). */
export async function verifyCongressGovApiKey(): Promise<boolean> {
  const apiKey = process.env.CONGRESS_GOV_API_KEY;
  if (!apiKey) return false;

  const url = new URL(`${CONGRESS_API}/member`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  return res.ok;
}
