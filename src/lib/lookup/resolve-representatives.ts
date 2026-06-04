import { demoLookup, lookupViaCiviq } from "@/lib/external/civiq";
import { lookupViaGeocodio } from "@/lib/external/geocodio";
import type { DistrictLookupResult } from "@/lib/types";

export async function resolveRepresentatives(address: string): Promise<DistrictLookupResult> {
  const geocodio = await lookupViaGeocodio(address);
  if (geocodio && geocodio.representatives.length > 0) return geocodio;

  const civiq = await lookupViaCiviq(address);
  if (civiq && civiq.representatives.length > 0) return civiq;

  if (process.env.CIVIC_MIRROR_DEMO_MODE === "true") {
    return demoLookup(address);
  }

  throw new Error(
    "Unable to resolve representatives. Configure GEOCODIO_API_KEY or enable CIVIC_MIRROR_DEMO_MODE.",
  );
}
