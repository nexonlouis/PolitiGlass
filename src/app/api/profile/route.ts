import { NextResponse } from "next/server";
import {
  parseIssueTagWeights,
  preferencesToWeightsJson,
} from "@/lib/legislation/issue-tag-preferences";
import { profileUpdateSchema } from "@/lib/validation/profile";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username, congressional_district, state")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: demo, error: demoError } = await supabase
    .from("user_demographics")
    .select(
      "birth_year, education_level, income_bracket, has_children, saved_issue_tags, issue_tag_weights",
    )
    .eq("user_id", user.id)
    .single();

  if (demoError) {
    return NextResponse.json({ error: demoError.message }, { status: 500 });
  }

  const tags = demo?.saved_issue_tags ?? [];
  const tagPreferences = parseIssueTagWeights(tags, demo?.issue_tag_weights);

  return NextResponse.json({
    username: profile.username,
    congressionalDistrict: profile.congressional_district,
    state: profile.state,
    demographics: {
      birthYear: demo?.birth_year ?? null,
      educationLevel: demo?.education_level ?? null,
      incomeBracket: demo?.income_bracket ?? null,
      hasChildren: demo?.has_children ?? null,
    },
    tagPreferences,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = profileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { username, demographics, tagPreferences } = parsed.data;
  const tags = tagPreferences.map((p) => p.slug);
  const issueTagWeights = preferencesToWeightsJson(tagPreferences);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      username,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    const message =
      profileError.code === "23505"
        ? "That username is already taken."
        : profileError.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { error: demoError } = await supabase.from("user_demographics").upsert({
    user_id: user.id,
    birth_year: demographics.birthYear ?? null,
    education_level: demographics.educationLevel ?? null,
    income_bracket: demographics.incomeBracket ?? null,
    has_children: demographics.hasChildren ?? null,
    saved_issue_tags: tags,
    issue_tag_weights: issueTagWeights,
    updated_at: new Date().toISOString(),
  });

  if (demoError) {
    return NextResponse.json({ error: demoError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
