const API_ROOT = "https://v3.openstates.org";

export interface OpenStatesPersonDetail {
  id: string;
  name: string;
  party?: string;
  image?: string;
  email?: string;
  gender?: string;
  birth_date?: string;
  openstates_url?: string;
  given_name?: string;
  family_name?: string;
  current_role?: {
    org_classification?: string;
    district?: string | number;
  };
  jurisdiction?: {
    division_id?: string;
    id?: string;
  };
}

function resolveApiKey(): string | null {
  return (
    process.env.OPENSTATES_PLURAL_API_KEY?.trim() ||
    process.env.OPENSTATES_API_KEY?.trim() ||
    null
  );
}

export async function fetchOpenStatesPersonById(
  personId: string,
): Promise<OpenStatesPersonDetail | null> {
  const apiKey = resolveApiKey();
  if (!apiKey) return null;

  const url = new URL(`${API_ROOT}/people`);
  url.searchParams.set("id", personId);

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-API-KEY": apiKey,
    },
    next: { revalidate: 86_400 },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { results?: OpenStatesPersonDetail[] };
  return data.results?.[0] ?? null;
}
