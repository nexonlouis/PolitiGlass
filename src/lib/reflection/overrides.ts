import type { SupabaseClient } from "@supabase/supabase-js";

export type AlignmentOverrideMap = Map<string, boolean>;

export async function fetchAlignmentOverrides(
  supabase: SupabaseClient,
  userId: string,
  bioguideId: string,
): Promise<AlignmentOverrideMap> {
  const { data, error } = await supabase
    .from("user_reflection_overrides")
    .select("bill_id, aligned")
    .eq("user_id", userId)
    .eq("bioguide_id", bioguideId.toUpperCase());

  if (error) {
    console.error("fetchAlignmentOverrides failed", error.message);
    return new Map();
  }

  const map: AlignmentOverrideMap = new Map();
  for (const row of data ?? []) {
    map.set(row.bill_id, row.aligned);
  }
  return map;
}

export async function upsertAlignmentOverride(
  supabase: SupabaseClient,
  userId: string,
  bioguideId: string,
  billId: string,
  aligned: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("user_reflection_overrides").upsert(
    {
      user_id: userId,
      bioguide_id: bioguideId.toUpperCase(),
      bill_id: billId,
      aligned,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,bioguide_id,bill_id" },
  );

  return { error: error?.message ?? null };
}

export async function deleteAlignmentOverride(
  supabase: SupabaseClient,
  userId: string,
  bioguideId: string,
  billId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("user_reflection_overrides")
    .delete()
    .eq("user_id", userId)
    .eq("bioguide_id", bioguideId.toUpperCase())
    .eq("bill_id", billId);

  return { error: error?.message ?? null };
}
