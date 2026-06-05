import { parseUsAddress } from "@/lib/address/parse-us-address";

export interface CensusDistrictResult {
  stateCode: string;
  districtNumber: string;
  lookupZip: string | null;
}

interface CensusMatch {
  addressComponents?: { state?: string; zip?: string };
  geographies?: Record<string, Array<{ BASENAME?: string }>>;
}

/**
 * Resolves congressional district using the US Census Bureau geocoder (free, no API key).
 */
export async function geocodeCongressionalDistrict(
  address: string,
): Promise<CensusDistrictResult | null> {
  const parsed = parseUsAddress(address);
  const query = parsed?.singleLine ?? address;

  const url = new URL(
    "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress",
  );
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "2020");
  url.searchParams.set("vintage", "2020");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      result?: { addressMatches?: CensusMatch[] };
    };
    const match = data.result?.addressMatches?.[0];
    if (!match) return null;

    const stateCode =
      match.addressComponents?.state?.toUpperCase() ??
      parsed?.state?.toUpperCase() ??
      null;
    if (!stateCode || stateCode.length !== 2) return null;

    const districtNumber = findCongressionalDistrictNumber(match.geographies);
    if (!districtNumber) return null;

    return {
      stateCode,
      districtNumber,
      lookupZip: match.addressComponents?.zip ?? parsed?.zip ?? null,
    };
  } catch (err) {
    console.error("Census geocoder failed", err);
    return null;
  }
}

function findCongressionalDistrictNumber(
  geographies: CensusMatch["geographies"],
): string | null {
  if (!geographies) return null;

  for (const key of Object.keys(geographies)) {
    if (!key.includes("Congressional District")) continue;
    const basename = geographies[key]?.[0]?.BASENAME;
    if (basename) return basename;
  }
  return null;
}
