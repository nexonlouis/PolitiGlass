import { NextResponse } from "next/server";
import { suggestIssueTags } from "@/lib/demographics/suggest-tags";
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

    const suggestedSlugs = suggestIssueTags(parsed.data);
    const suggested = suggestedSlugs.map((slug) => {
      const def = ISSUE_TAGS.find((t) => t.slug === slug);
      return { slug, label: def?.label ?? slug, description: def?.description ?? "" };
    });

    const all = ISSUE_TAGS.map((t) => ({
      slug: t.slug,
      label: t.label,
      description: t.description,
      suggested: suggestedSlugs.includes(t.slug),
    }));

    return NextResponse.json({ suggested, all });
  } catch {
    return NextResponse.json({ error: "Failed to suggest tags" }, { status: 500 });
  }
}
