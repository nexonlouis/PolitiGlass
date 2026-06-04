import type { DistrictLookupResult, Representative } from "@/lib/types";

interface GeocodioLegislator {
  bio: {
    bioguide_id?: string;
    first_name: string;
    last_name: string;
    party: string;
    photo_url?: string;
  };
  type: string;
  contact?: {
    url?: string;
    phone?: string;
  };
}

interface GeocodioResponse {
  results: Array<{
    response: {
      results: {
        congress?: Array<{ district_number: string; name: string }>;
        state_legislative?: unknown;
      };
      legislators: Array<{
        type: string;
        bio: GeocodioLegislator["bio"];
        contact?: GeocodioLegislator["contact"];
        state?: string;
        district?: string;
      }>;
    };
  }>;
}

export async function lookupViaGeocodio(address: string): Promise<DistrictLookupResult | null> {
  const apiKey = process.env.GEOCODIO_API_KEY;
  if (!apiKey) return null;

  const url = new URL("https://api.geocod.io/v1.9/legislators");
  url.searchParams.set("q", address);
  url.searchParams.set("fields", "legislators");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) {
    console.error("Geocodio error", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as GeocodioResponse;
  const first = data.results?.[0]?.response;
  if (!first) return null;

  const congress = first.results?.congress?.[0];
  const state = extractStateFromLegislators(first.legislators) ?? "US";
  const districtNum = congress?.district_number;
  const congressionalDistrict =
    districtNum && state !== "US" ? `${state}-${districtNum}` : "unassigned";

  const representatives = mapGeocodioLegislators(first.legislators, state);

  return {
    congressionalDistrict,
    state,
    ocdDivisionId: null,
    lookupZip: extractZip(address),
    representatives,
    source: "geocodio",
  };
}

function mapGeocodioLegislators(
  legislators: GeocodioResponse["results"][0]["response"]["legislators"],
  fallbackState: string,
): Representative[] {
  const reps: Representative[] = [];

  for (const leg of legislators ?? []) {
    const type = leg.type?.toLowerCase() ?? "";
    let chamber: Representative["chamber"] | null = null;
    if (type.includes("senator")) chamber = "senate";
    else if (type.includes("representative") && !type.includes("state"))
      chamber = "house";

    if (!chamber) continue;

    const bioguideId =
      leg.bio.bioguide_id ??
      `${chamber}-${leg.bio.last_name}-${leg.bio.first_name}`.toLowerCase();

    reps.push({
      bioguideId,
      fullName: `${leg.bio.first_name} ${leg.bio.last_name}`.trim(),
      chamber,
      party: leg.bio.party ?? null,
      photoUrl: leg.bio.photo_url ?? null,
      state: leg.state ?? fallbackState,
      district: leg.district ?? null,
      officePhone: leg.contact?.phone ?? null,
      officialWebsite: leg.contact?.url ?? null,
    });
  }

  return reps;
}

function extractStateFromLegislators(
  legislators: GeocodioResponse["results"][0]["response"]["legislators"],
): string | null {
  const senator = legislators?.find((l) => l.type?.toLowerCase().includes("senator"));
  return senator?.state ?? legislators?.[0]?.state ?? null;
}

function extractZip(address: string): string | null {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match?.[1] ?? null;
}
