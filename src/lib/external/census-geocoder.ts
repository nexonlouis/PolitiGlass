import { parseUsAddress } from "@/lib/address/parse-us-address";
import { getCurrentCongress } from "@/lib/config/congress";

export interface CensusDistrictResult {
  stateCode: string;
  districtNumber: string;
  lookupZip: string | null;
}

interface CensusGeoRow {
  BASENAME?: string;
  CD119?: string;
  NAME?: string;
}

interface CensusMatch {
  addressComponents?: { state?: string; zip?: string };
  geographies?: Record<string, CensusGeoRow[]>;
}

/** Public_AR_Current — most up-to-date address ranges. */
const CENSUS_BENCHMARK = "4";
/** Current_Current — geographies aligned with the current benchmark. */
const CENSUS_VINTAGE = "4";
/** 119th Congressional Districts layer (see Census Geocoder User Guide, Table 3). */
const CONGRESSIONAL_DISTRICT_LAYER = "54";

/**
 * Resolves congressional district using the US Census Bureau geocoder (free, no API key).
 * Uses current address ranges and 119th Congress district boundaries.
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
  url.searchParams.set("benchmark", CENSUS_BENCHMARK);
  url.searchParams.set("vintage", CENSUS_VINTAGE);
  url.searchParams.set("layers", CONGRESSIONAL_DISTRICT_LAYER);
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

    const districtNumber = findCongressionalDistrictNumber(
      stateCode,
      match.geographies,
    );
    if (districtNumber === null) return null;

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
  stateCode: string,
  geographies: CensusMatch["geographies"],
): string | null {
  if (!geographies) return null;

  const congress = getCurrentCongress();
  const preferredKey = `${congress}th Congressional Districts`;

  const layers = Object.entries(geographies).filter(([key]) =>
    key.includes("Congressional District"),
  );
  layers.sort(([a], [b]) => {
    if (a === preferredKey) return -1;
    if (b === preferredKey) return 1;
    const sessionScore = (key: string) => {
      const match = key.match(/(\d+)th Congressional Districts/);
      return match ? -Number(match[1]) : -999;
    };
    return sessionScore(a) - sessionScore(b);
  });

  for (const [, rows] of layers) {
    const row = rows?.[0];
    if (!row) continue;
    const normalized = normalizeCongressionalDistrictNumber(stateCode, row);
    if (normalized !== null) return normalized;
  }

  return null;
}

function normalizeCongressionalDistrictNumber(
  stateCode: string,
  row: CensusGeoRow,
): string | null {
  // Congress.gov member API uses district 0 for DC's delegate and at-large states.
  if (stateCode === "DC") return "0";

  const cdField = row.CD119?.trim();
  if (cdField && /^\d+$/.test(cdField)) {
    return String(parseInt(cdField, 10));
  }

  const basename = row.BASENAME?.trim() ?? "";
  if (/^\d+$/.test(basename)) {
    return String(parseInt(basename, 10));
  }

  const label = `${basename} ${row.NAME ?? ""}`;
  if (/at large/i.test(label)) {
    return "0";
  }

  return null;
}
