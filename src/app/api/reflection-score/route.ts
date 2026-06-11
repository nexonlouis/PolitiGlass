import { NextResponse } from "next/server";
import { fetchMemberVotesFromDb } from "@/lib/legislation/member-votes-db";
import { parsePreferencesFromQuery } from "@/lib/legislation/issue-tag-preferences";
import { computeReflectionScore } from "@/lib/legislation/reflection-score";
import { reflectionQuerySchema } from "@/lib/validation/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = reflectionQuerySchema.safeParse({
    bioguideId: searchParams.get("bioguideId"),
    includeVotes: searchParams.get("includeVotes") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "bioguideId is required" }, { status: 400 });
  }

  const tagsParam = searchParams.get("tags");
  const tags = tagsParam ? tagsParam.split(",").filter(Boolean) : ["healthcare"];
  const preferences = parsePreferencesFromQuery(tags, searchParams);

  const tagWeights = Object.fromEntries(preferences.map((p) => [p.slug, p.weight]));

  const votes = await fetchMemberVotesFromDb(parsed.data.bioguideId, {
    limit: 60,
    preferences,
    scoringOnly: true,
  });

  const result = computeReflectionScore(votes, tagWeights, {
    includeAllVotes: parsed.data.includeVotes ?? true,
  });

  return NextResponse.json({
    ...result,
    source: "database",
    bioguideId: parsed.data.bioguideId,
  });
}
