export interface OfficialTerm {
  chamber: string;
  start?: string | null;
  end?: string | null;
  state?: string | null;
  district?: string | null;
  party?: string | null;
}

export interface OfficialExternalLink {
  label: string;
  url: string;
}

export interface OfficialProfile {
  id: string;
  fullName: string;
  chamber: "house" | "senate" | "state";
  stateLegislativeChamber?: "lower" | "upper" | null;
  party: string | null;
  photoUrl: string | null;
  state: string;
  district: string | null;
  email?: string | null;
  phone?: string | null;
  officeAddress?: string | null;
  officialWebsite?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  terms: OfficialTerm[];
  externalLinks: OfficialExternalLink[];
  sources: string[];
}
