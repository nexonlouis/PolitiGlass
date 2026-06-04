import type { DistrictLookupResult, Representative } from "@/lib/types";

const DEFAULT_BASE = "https://civdotiq.org/api/v1";

export async function lookupViaCiviq(address: string): Promise<DistrictLookupResult | null> {
  const base = process.env.CIVIQ_API_BASE_URL ?? DEFAULT_BASE;
  const intelligenceUrl = base.replace(/\/v1\/?$/, "") + "/intelligence/address/representatives";

  try {
    const res = await fetch(intelligenceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ address }),
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      const listUrl = new URL(`${base}/representatives`);
      const state = guessStateFromAddress(address);
      if (state) {
        listUrl.searchParams.set("state", state);
        listUrl.searchParams.set("chamber", "house");
        const listRes = await fetch(listUrl.toString(), {
          headers: { Accept: "application/json" },
          next: { revalidate: 86400 },
        });
        if (listRes.ok) {
          return mapCiviqList(await listRes.json(), address, state);
        }
      }
      return null;
    }

    return mapCiviqAddressPayload(await res.json(), address);
  } catch (err) {
    console.error("CIV.IQ lookup failed", err);
    return null;
  }
}

function mapCiviqAddressPayload(
  payload: unknown,
  address: string,
): DistrictLookupResult | null {
  const data = payload as {
    congressionalDistrict?: string;
    state?: string;
    representatives?: Array<Record<string, unknown>>;
    federal?: Array<Record<string, unknown>>;
  };

  const rawList = data.representatives ?? data.federal ?? [];
  if (!Array.isArray(rawList) || rawList.length === 0) return null;

  const representatives = rawList.map(mapCiviqRep).filter(Boolean) as Representative[];
  const state =
    data.state ?? representatives[0]?.state ?? guessStateFromAddress(address) ?? "US";

  const congressionalDistrict =
    data.congressionalDistrict ??
    representatives.find((r) => r.chamber === "house")?.district ??
    "unassigned";

  return {
    congressionalDistrict: normalizeDistrict(congressionalDistrict, state),
    state,
    ocdDivisionId: null,
    lookupZip: extractZip(address),
    representatives,
    source: "civiq",
  };
}

function mapCiviqList(
  payload: unknown,
  address: string,
  state: string,
): DistrictLookupResult | null {
  const data = payload as { data?: Array<Record<string, unknown>> };
  const list = data.data ?? (Array.isArray(payload) ? payload : []);
  if (!Array.isArray(list) || list.length === 0) return null;

  const representatives = list.slice(0, 3).map(mapCiviqRep).filter(Boolean) as Representative[];

  return {
    congressionalDistrict: "unassigned",
    state,
    ocdDivisionId: null,
    lookupZip: extractZip(address),
    representatives,
    source: "civiq",
  };
}

function mapCiviqRep(raw: Record<string, unknown>): Representative | null {
  const bioguideId = (raw.bioguideId ?? raw.bioguide_id ?? raw.id) as string | undefined;
  const name = (raw.fullName ?? raw.name ?? `${raw.firstName ?? ""} ${raw.lastName ?? ""}`)
    .toString()
    .trim();
  if (!name) return null;

  const chamberRaw = (raw.chamber ?? raw.office ?? "house").toString().toLowerCase();
  const chamber: Representative["chamber"] = chamberRaw.includes("senate")
    ? "senate"
    : chamberRaw.includes("house")
      ? "house"
      : "state";

  return {
    bioguideId: bioguideId ?? `civiq-${name.replace(/\s+/g, "-").toLowerCase()}`,
    fullName: name,
    chamber,
    party: (raw.party as string) ?? null,
    photoUrl: (raw.photoUrl ?? raw.photo_url ?? raw.imageUrl) as string | null,
    state: (raw.state as string) ?? "US",
    district: (raw.district as string) ?? null,
  };
}

function normalizeDistrict(district: string, state: string): string {
  if (district.includes("-")) return district;
  if (/^\d+$/.test(district)) return `${state}-${district}`;
  return district;
}

function guessStateFromAddress(address: string): string | null {
  const match = address.match(/\b([A-Z]{2})\b\s*\d{5}/);
  return match?.[1] ?? null;
}

function extractZip(address: string): string | null {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match?.[1] ?? null;
}

export function demoLookup(address: string): DistrictLookupResult {
  const state = guessStateFromAddress(address) ?? "CA";
  return {
    congressionalDistrict: `${state}-12`,
    state,
    ocdDivisionId: null,
    lookupZip: extractZip(address),
    source: "demo",
    representatives: [
      {
        bioguideId: "D000623",
        fullName: "Demo House Representative",
        chamber: "house",
        party: "Democrat",
        photoUrl: null,
        state,
        district: "12",
      },
      {
        bioguideId: "S000001",
        fullName: "Demo Senator One",
        chamber: "senate",
        party: "Democrat",
        photoUrl: null,
        state,
        district: null,
      },
      {
        bioguideId: "S000002",
        fullName: "Demo Senator Two",
        chamber: "senate",
        party: "Republican",
        photoUrl: null,
        state,
        district: null,
      },
    ],
  };
}
