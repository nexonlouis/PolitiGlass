import {
  fetchCongressGovMember,
  findLegislatorByBioguide,
  formatLegislatorName,
  latestLegislatorTerm,
} from "@/lib/external/congress-member-detail";
import { fetchOpenStatesPersonById } from "@/lib/external/openstates-person";
import { isStateLegislatorId } from "@/lib/legislators/id-map";
import type { OfficialProfile, OfficialTerm } from "@/lib/officials/types";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function chamberFromCongressTerms(
  terms: Array<{ type?: string }>,
  fallback: "house" | "senate",
): "house" | "senate" {
  const latest = terms[terms.length - 1];
  if (latest?.type === "sen") return "senate";
  if (latest?.type === "rep") return "house";
  return fallback;
}

function mapCongressLegislatorTerms(
  record: NonNullable<Awaited<ReturnType<typeof findLegislatorByBioguide>>>,
): OfficialTerm[] {
  return (record.terms ?? []).map((term) => ({
    chamber: term.type === "sen" ? "U.S. Senate" : "U.S. House",
    start: term.start ?? null,
    end: term.end ?? null,
    state: term.state ?? null,
    district: term.district != null ? String(term.district) : null,
    party: term.party ?? null,
  }));
}

function mapCongressGovTerms(member: NonNullable<Awaited<ReturnType<typeof fetchCongressGovMember>>>): OfficialTerm[] {
  const items = member.terms?.item;
  const list = Array.isArray(items) ? items : items ? [items] : [];
  return list.map((term) => ({
    chamber: term.chamber ?? "Congress",
    start: term.startYear != null ? String(term.startYear) : null,
    end: term.endYear != null ? String(term.endYear) : null,
    state: term.stateCode ?? member.state ?? null,
    district: term.district != null ? String(term.district) : null,
    party: member.partyName ?? null,
  }));
}

async function fetchFederalOfficialProfile(bioguideId: string): Promise<OfficialProfile | null> {
  const [legislator, congressGov] = await Promise.all([
    findLegislatorByBioguide(bioguideId),
    fetchCongressGovMember(bioguideId),
  ]);

  if (!legislator && !congressGov) return null;

  const latestTerm = legislator ? latestLegislatorTerm(legislator) : undefined;
  const chamber = legislator
    ? chamberFromCongressTerms(legislator.terms ?? [], latestTerm?.type === "sen" ? "senate" : "house")
    : congressGov?.terms?.item
      ? Array.isArray(congressGov.terms.item)
        ? congressGov.terms.item.some((t) => t.chamber?.includes("Senate"))
          ? "senate"
          : "house"
        : congressGov.terms.item.chamber?.includes("Senate")
          ? "senate"
          : "house"
      : "house";

  const fullName =
    congressGov?.directOrderName ||
    formatLegislatorName(legislator ?? {}, congressGov?.name) ||
    bioguideId;

  const state =
    congressGov?.state ||
    latestTerm?.state ||
    mapCongressGovTerms(congressGov ?? { terms: {} })[0]?.state ||
    "";

  const district =
    congressGov?.district != null
      ? String(congressGov.district)
      : latestTerm?.district != null
        ? String(latestTerm.district)
        : null;

  const terms = legislator?.terms?.length
    ? mapCongressLegislatorTerms(legislator)
    : congressGov
      ? mapCongressGovTerms(congressGov)
      : [];

  const externalLinks: OfficialProfile["externalLinks"] = [
    {
      label: "Congress.gov profile",
      url: `https://www.congress.gov/member/${bioguideId.toUpperCase()}`,
    },
  ];

  if (legislator?.id?.wikipedia) {
    externalLinks.push({
      label: "Wikipedia",
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(legislator.id.wikipedia.replace(/ /g, "_"))}`,
    });
  }

  const officialWebsite =
    congressGov?.officialWebsiteUrl || latestTerm?.url || null;
  if (officialWebsite) {
    externalLinks.unshift({ label: "Official website", url: officialWebsite });
  }

  const sources = ["unitedstates/congress-legislators"];
  if (congressGov) sources.push("Congress.gov");

  return {
    id: bioguideId.toUpperCase(),
    fullName,
    chamber,
    party: congressGov?.partyName || latestTerm?.party || null,
    photoUrl: congressGov?.depiction?.imageUrl ?? null,
    state,
    district: chamber === "house" ? district : null,
    email: null,
    phone: latestTerm?.phone ?? null,
    officeAddress: latestTerm?.address ?? null,
    officialWebsite,
    birthDate: legislator?.bio?.birthday || congressGov?.birthYear || null,
    gender: legislator?.bio?.gender ?? null,
    terms,
    externalLinks,
    sources,
  };
}

async function fetchStateOfficialProfile(personId: string): Promise<OfficialProfile | null> {
  const supabase = (await createServiceClient()) ?? (await createClient());
  const { data } = await supabase
    .from("state_legislators")
    .select("person_id, state, name, party, chamber, district, image_url, email")
    .eq("person_id", personId)
    .maybeSingle();
  const dbRow = data;

  const apiPerson = await fetchOpenStatesPersonById(personId);

  if (!dbRow && !apiPerson) return null;

  const chamber = (dbRow?.chamber || apiPerson?.current_role?.org_classification) as
    | "lower"
    | "upper"
    | undefined;

  const externalLinks: OfficialProfile["externalLinks"] = [];
  if (apiPerson?.openstates_url) {
    externalLinks.push({ label: "Open States profile", url: apiPerson.openstates_url });
  }

  const email = dbRow?.email || apiPerson?.email || null;
  if (email) {
    externalLinks.push({ label: "Email", url: `mailto:${email}` });
  }

  const sources = [];
  if (dbRow) sources.push("PolitiGlass state_legislators");
  if (apiPerson) sources.push("Open States");

  return {
    id: personId,
    fullName: dbRow?.name || apiPerson?.name || personId,
    chamber: "state",
    stateLegislativeChamber: chamber ?? null,
    party: dbRow?.party || apiPerson?.party || null,
    photoUrl: dbRow?.image_url || apiPerson?.image || null,
    state: dbRow?.state || "—",
    district:
      dbRow?.district ||
      (apiPerson?.current_role?.district != null
        ? String(apiPerson.current_role.district)
        : null),
    email,
    officialWebsite: apiPerson?.openstates_url ?? null,
    birthDate: apiPerson?.birth_date || null,
    gender: apiPerson?.gender || null,
    terms: [],
    externalLinks,
    sources,
  };
}

export async function fetchOfficialProfile(officialId: string): Promise<OfficialProfile | null> {
  const id = officialId.trim();
  if (!id) return null;

  if (isStateLegislatorId(id)) {
    return fetchStateOfficialProfile(id);
  }

  return fetchFederalOfficialProfile(id);
}
