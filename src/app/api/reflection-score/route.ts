import { NextResponse } from "next/server";
import { fetchMemberVotesFromDb } from "@/lib/legislation/member-votes-db";
import { computeReflectionScore } from "@/lib/legislation/reflection-score";
import { reflectionQuerySchema } from "@/lib/validation/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bioguideParsed = reflectionQuerySchema.safeParse({
    bioguideId: searchParams.get("bioguideId"),
  });

  if (!bioguideParsed.success) {
    return NextResponse.json({ error: "bioguideId is required" }, { status: 400 });
  }

  const tagsParam = searchParams.get("tags");
  const tags = tagsParam ? tagsParam.split(",").filter(Boolean) : ["healthcare"];

  const tagWeights: Record<string, number> = {};
  for (const tag of tags) {
    tagWeights[tag] = Number(searchParams.get(`weight_${tag}`)) || 3;
  }

  const votes = await fetchMemberVotesFromDb(bioguideParsed.data.bioguideId, {
    limit: 40,
    userTags: tags,
  });

  const result = computeReflectionScore(votes, tagWeights);

  return NextResponse.json({
    ...result,
    source: "database",
    bioguideId: bioguideParsed.data.bioguideId,
  });
}
