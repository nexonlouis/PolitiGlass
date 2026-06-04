import { NextResponse } from "next/server";
import { resolveRepresentatives } from "@/lib/lookup/resolve-representatives";
import { addressSchema } from "@/lib/validation/api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = addressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await resolveRepresentatives(parsed.data.address);

    return NextResponse.json({
      congressionalDistrict: result.congressionalDistrict,
      state: result.state,
      ocdDivisionId: result.ocdDivisionId,
      lookupZip: result.lookupZip,
      representatives: result.representatives,
      source: result.source,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
