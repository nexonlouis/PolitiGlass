import { lookupViaCiviq, lookupViaCiviqStructured, demoLookup } from "@/lib/external/civiq";
import { lookupViaCongressGov } from "@/lib/external/congress-members";
import { geocodeAddressCoordinates } from "@/lib/external/census-geocoder";
import { lookupViaGeocodio } from "@/lib/external/geocodio";
import { lookupStateLegislatorsAtGeo } from "@/lib/external/openstates-people";
import type { DistrictLookupResult } from "@/lib/types";

async function appendStateLegislators(
  result: DistrictLookupResult,
  address: string,
): Promise<DistrictLookupResult> {
  const coords = await geocodeAddressCoordinates(address);
  if (!coords) return result;

  const stateCode = coords.stateCode ?? result.state;
  const stateLookup = await lookupStateLegislatorsAtGeo(coords.lat, coords.lng, stateCode);
  if (stateLookup.representatives.length === 0) return result;

  const existingIds = new Set(result.representatives.map((r) => r.bioguideId));

  return {
    ...result,
    stateHouseDistrict: stateLookup.stateHouseDistrict ?? result.stateHouseDistrict,
    stateSenateDistrict: stateLookup.stateSenateDistrict ?? result.stateSenateDistrict,
    representatives: [
      ...result.representatives,
      ...stateLookup.representatives.filter((r) => !existingIds.has(r.bioguideId)),
    ],
    stateLegislatorsIncluded: true,
  };
}

export async function resolveRepresentatives(address: string): Promise<DistrictLookupResult> {
  // Prefer Census (current districts) + Congress.gov members — same federal source as congress.gov.
  const congress = await lookupViaCongressGov(address);
  if (congress && congress.representatives.length > 0) {
    return appendStateLegislators(congress, address);
  }

  const geocodio = await lookupViaGeocodio(address);
  if (geocodio && geocodio.representatives.length > 0) {
    return appendStateLegislators(geocodio, address);
  }

  const civiqStructured = await lookupViaCiviqStructured(address);
  if (civiqStructured && civiqStructured.representatives.length > 0) {
    return appendStateLegislators(civiqStructured, address);
  }

  const civiq = await lookupViaCiviq(address);
  if (civiq && civiq.representatives.length > 0) {
    return appendStateLegislators(civiq, address);
  }

  if (process.env.POLITIGLASS_DEMO_MODE === "true") {
    return demoLookup(address);
  }

  throw new Error(
    "Unable to resolve representatives. Use a full US address (street, city, ST zip) or set GEOCODIO_API_KEY.",
  );
}
