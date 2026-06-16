import { jurisdictionId } from "./paths.js";

export { filterSessions } from "../../lib/openstates-session-filters.js";

const API_ROOT = "https://v3.openstates.org";

export interface LegislativeSessionDownload {
  url: string;
  type?: string;
}

export interface LegislativeSession {
  identifier: string;
  name: string;
  start_date?: string;
  end_date?: string;
  downloads?: LegislativeSessionDownload[];
}

export interface JurisdictionSummary {
  id: string;
  name: string;
  classification: string;
  division_id?: string;
}

export interface JurisdictionDetail extends JurisdictionSummary {
  legislative_sessions?: LegislativeSession[];
}

export interface OpenStatesPerson {
  id: string;
  name: string;
  party?: string;
  current_role?: {
    title?: string;
    org_classification?: string;
    district?: string;
    division_id?: string;
  };
  jurisdiction?: JurisdictionSummary;
  given_name?: string;
  family_name?: string;
  image?: string;
  email?: string;
}

function apiKey(): string {
  const key =
    process.env.OPENSTATES_PLURAL_API_KEY?.trim() ||
    process.env.OPENSTATES_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Set OPENSTATES_PLURAL_API_KEY or OPENSTATES_API_KEY in .env.local or scripts/download-openstates/.env",
    );
  }
  return key;
}

async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(API_ROOT + path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-API-KEY": apiKey(),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Open States API ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json() as Promise<T>;
}

/** All state-level jurisdictions (50 states + DC, etc.). */
export async function listStateJurisdictions(): Promise<JurisdictionSummary[]> {
  const data = await apiGet<{ results: JurisdictionSummary[] }>("/jurisdictions", {
    classification: "state",
    per_page: "52",
  });
  return data.results ?? [];
}

export async function getJurisdictionWithSessions(
  jurisdictionId: string,
): Promise<JurisdictionDetail> {
  return apiGet<JurisdictionDetail>(
    `/jurisdictions/${encodeURIComponent(jurisdictionId)}`,
    { include: "legislative_sessions" },
  );
}

/** Fetch jurisdiction + sessions for a state postal abbreviation. */
export async function resolveStateAbbr(abbr: string): Promise<{
  abbr: string;
  jurisdiction: JurisdictionDetail;
}> {
  const upper = abbr.toUpperCase();
  const id = jurisdictionId(upper);

  try {
    const jurisdiction = await getJurisdictionWithSessions(id);
    return { abbr: upper, jurisdiction };
  } catch {
    throw new Error(`No Open States jurisdiction found for state ${upper}`);
  }
}

export function stateAbbrFromJurisdiction(j: JurisdictionSummary): string | null {
  const fromDivision = j.division_id?.match(/state:([a-z]{2})$/i)?.[1];
  if (fromDivision) return fromDivision.toUpperCase();
  const fromId = j.id.match(/state:([a-z]{2})\//i)?.[1];
  return fromId ? fromId.toUpperCase() : null;
}

export function peopleCsvUrl(stateAbbr: string): string {
  return `https://data.openstates.org/people/current/${stateAbbr.toUpperCase()}.csv`;
}

/** Paginated legislator list (bulk people CSV is often 403; API is reliable). */
export async function fetchStatePeople(jurisdictionId: string): Promise<OpenStatesPerson[]> {
  const people: OpenStatesPerson[] = [];
  let page = 1;
  let maxPage = 1;

  do {
    const data = await apiGet<{
      results: OpenStatesPerson[];
      pagination?: { max_page?: number };
    }>("/people", {
      jurisdiction: jurisdictionId,
      per_page: "50",
      page: String(page),
    });
    people.push(...(data.results ?? []));
    maxPage = data.pagination?.max_page ?? page;
    page += 1;
  } while (page <= maxPage);

  return people;
}

export function pickSessionCsvDownload(session: LegislativeSession): string | null {
  const downloads = session.downloads ?? [];
  const csv = downloads.find((d) => d.url?.includes("_csv_") || d.url?.endsWith(".zip"));
  return csv?.url ?? downloads[0]?.url ?? null;
}
