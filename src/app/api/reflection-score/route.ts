import { NextResponse } from "next/server";
import { fetchHouseVotesForMember } from "@/lib/external/congress";
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

  const votes = await fetchHouseVotesForMember(bioguideParsed.data.bioguideId);
  const scoredVotes = votes.map((v) => ({
    ...v,
    issueSlug: tags[0] ?? v.issueSlug,
    userSupportsBill: true,
  }));

  const result = computeReflectionScore(scoredVotes, tagWeights);

  return NextResponse.json(result);
}
