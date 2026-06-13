import { NextResponse } from "next/server";
import {
  deleteAlignmentOverride,
  upsertAlignmentOverride,
} from "@/lib/reflection/overrides";
import {
  reflectionOverrideDeleteSchema,
  reflectionOverrideSchema,
} from "@/lib/validation/reflection-overrides";
import { createClient } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = reflectionOverrideSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { bioguideId, billId, aligned } = parsed.data;
  const { error } = await upsertAlignmentOverride(
    supabase,
    user.id,
    bioguideId,
    billId,
    aligned,
  );

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bioguideId, billId, aligned });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = reflectionOverrideDeleteSchema.safeParse({
    bioguideId: searchParams.get("bioguideId"),
    billId: searchParams.get("billId"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "bioguideId and billId are required" }, { status: 400 });
  }

  const { error } = await deleteAlignmentOverride(
    supabase,
    user.id,
    parsed.data.bioguideId,
    parsed.data.billId,
  );

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
