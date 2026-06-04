import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { demographicsSchema, issueTagsSchema } from "@/lib/validation/api";
import { z } from "zod";

const completeSchema = z.object({
  congressionalDistrict: z.string().min(1),
  state: z.string().min(2).max(2),
  ocdDivisionId: z.string().optional().nullable(),
  lookupZip: z.string().optional().nullable(),
  representatives: z.array(
    z.object({
      bioguideId: z.string(),
      fullName: z.string(),
      chamber: z.enum(["house", "senate", "state"]),
      party: z.string().nullable().optional(),
      photoUrl: z.string().nullable().optional(),
      state: z.string(),
      district: z.string().nullable().optional(),
    }),
  ),
  demographics: demographicsSchema,
  tags: issueTagsSchema.shape.tags,
  weights: issueTagsSchema.shape.weights.optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in required to save your profile." },
      { status: 401 },
    );
  }

  const body = await request.json();
  const parsed = completeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { congressionalDistrict, state, ocdDivisionId, lookupZip, representatives } =
    parsed.data;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      congressional_district: congressionalDistrict,
      state,
      ocd_division_id: ocdDivisionId,
      lookup_zip: lookupZip,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const weights = parsed.data.weights ?? {};
  for (const tag of parsed.data.tags) {
    if (!weights[tag]) weights[tag] = 3;
  }

  const { error: demoError } = await supabase.from("user_demographics").upsert({
    user_id: user.id,
    birth_year: parsed.data.demographics.birthYear ?? null,
    education_level: parsed.data.demographics.educationLevel ?? null,
    income_bracket: parsed.data.demographics.incomeBracket ?? null,
    has_children: parsed.data.demographics.hasChildren ?? null,
    saved_issue_tags: parsed.data.tags,
    issue_tag_weights: weights,
    updated_at: new Date().toISOString(),
  });

  if (demoError) {
    return NextResponse.json({ error: demoError.message }, { status: 500 });
  }

  await supabase.from("saved_representatives").delete().eq("user_id", user.id);

  if (representatives.length > 0) {
    const { error: repsError } = await supabase.from("saved_representatives").insert(
      representatives.map((r) => ({
        user_id: user.id,
        bioguide_id: r.bioguideId,
        full_name: r.fullName,
        chamber: r.chamber,
        party: r.party ?? null,
        photo_url: r.photoUrl ?? null,
        state: r.state,
        district: r.district ?? null,
      })),
    );

    if (repsError) {
      return NextResponse.json({ error: repsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
