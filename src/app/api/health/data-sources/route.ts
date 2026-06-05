import { NextResponse } from "next/server";
import { verifyCongressGovApiKey } from "@/lib/external/congress-members";

export async function GET() {
  const congressGov = await verifyCongressGovApiKey();

  return NextResponse.json({
    congressGov: {
      configured: Boolean(process.env.CONGRESS_GOV_API_KEY),
      reachable: congressGov,
      usedFor: ["federal_official_lookup"],
    },
    legislationDatabase: {
      configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      usedFor: ["voting_records", "reflection_score"],
      note: "Reads roll_call_* tables ingested via scripts/ingest-congress",
    },
    geocodio: {
      configured: Boolean(process.env.GEOCODIO_API_KEY),
      usedFor: ["address_to_officials_primary"],
    },
    civiq: {
      configured: true,
      usedFor: ["address_fallback", "senate_votes_future"],
    },
    censusGeocoder: {
      configured: true,
      usedFor: ["address_to_congressional_district"],
    },
    demoMode: process.env.CIVIC_MIRROR_DEMO_MODE === "true",
  });
}
