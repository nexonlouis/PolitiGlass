import { lookupViaCiviq, lookupViaCiviqStructured, demoLookup } from "@/lib/external/civiq";
import { lookupViaCongressGov } from "@/lib/external/congress-members";
import { lookupViaGeocodio } from "@/lib/external/geocodio";
import type { DistrictLookupResult } from "@/lib/types";

export async function resolveRepresentatives(address: string): Promise<DistrictLookupResult> {
  // Prefer Census (current districts) + Congress.gov members — same federal source as congress.gov.
  const congress = await lookupViaCongressGov(address);
  if (congress && congress.representatives.length > 0) return congress;

  const geocodio = await lookupViaGeocodio(address);
  if (geocodio && geocodio.representatives.length > 0) return geocodio;

  const civiqStructured = await lookupViaCiviqStructured(address);
  if (civiqStructured && civiqStructured.representatives.length > 0) return civiqStructured;

  const civiq = await lookupViaCiviq(address);
  if (civiq && civiq.representatives.length > 0) return civiq;

  if (process.env.CIVIC_MIRROR_DEMO_MODE === "true") {
    return demoLookup(address);
  }

  throw new Error(
    "Unable to resolve representatives. Use a full US address (street, city, ST zip) or set GEOCODIO_API_KEY.",
  );
}
