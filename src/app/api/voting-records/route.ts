import { NextResponse } from "next/server";
import { fetchHouseVotesForMember } from "@/lib/external/congress";
import { reflectionQuerySchema } from "@/lib/validation/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = reflectionQuerySchema.safeParse({
    bioguideId: searchParams.get("bioguideId"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "bioguideId is required" }, { status: 400 });
  }

  const votes = await fetchHouseVotesForMember(parsed.data.bioguideId);

  return NextResponse.json({
    bioguideId: parsed.data.bioguideId,
    votes,
    note:
      votes.length === 0
        ? "House roll calls require CONGRESS_GOV_API_KEY. Senate votes need LegiScan or CIV.IQ."
        : undefined,
  });
}
