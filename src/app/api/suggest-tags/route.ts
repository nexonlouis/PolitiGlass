import { NextResponse } from "next/server";
import {
  rankTagsByDemographics,
  suggestIssueTags,
} from "@/lib/demographics/suggest-tags";
import {
  getTopSuggestedSlugs,
  sortTagsForDisplay,
} from "@/lib/constants/issue-tag-graph";
import { ISSUE_TAGS } from "@/lib/constants/issue-tags";
import { demographicsSchema } from "@/lib/validation/api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = demographicsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const scores = rankTagsByDemographics(parsed.data);
    const suggestedSlugs = suggestIssueTags(parsed.data);
    const rankedSlugs = sortTagsForDisplay(scores).map((t) => t.slug);
    const topSuggested = getTopSuggestedSlugs(scores);

    const suggested = suggestedSlugs.map((slug) => {
      const def = ISSUE_TAGS.find((t) => t.slug === slug);
      return { slug, label: def?.label ?? slug, description: def?.description ?? "" };
    });

    const all = sortTagsForDisplay(scores).map((t) => ({
      slug: t.slug,
      label: t.label,
      description: t.description,
      suggested: topSuggested.includes(t.slug),
      score: scores.get(t.slug) ?? 0,
    }));

    return NextResponse.json({
      suggested,
      all,
      rankedSlugs,
      scores: Object.fromEntries(scores),
    });
  } catch {
    return NextResponse.json({ error: "Failed to suggest tags" }, { status: 500 });
  }
}
