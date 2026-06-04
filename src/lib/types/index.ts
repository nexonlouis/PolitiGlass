export type Chamber = "house" | "senate" | "state";

export interface Representative {
  bioguideId: string;
  fullName: string;
  chamber: Chamber;
  party: string | null;
  photoUrl: string | null;
  state: string;
  district: string | null;
  officePhone?: string | null;
  officialWebsite?: string | null;
}

export interface DistrictLookupResult {
  congressionalDistrict: string;
  state: string;
  ocdDivisionId: string | null;
  lookupZip: string | null;
  representatives: Representative[];
  source: "geocodio" | "civiq" | "demo";
}

export interface DemographicsInput {
  birthYear?: number | null;
  educationLevel?: string | null;
  incomeBracket?: string | null;
  hasChildren?: boolean | null;
}

export interface ReflectionScoreResult {
  score: number;
  confidence: "low" | "moderate" | "strong";
  votesAnalyzed: number;
  message: string;
  aligned: VoteAlignmentItem[];
  diverged: VoteAlignmentItem[];
}

export interface VoteAlignmentItem {
  billId: string;
  title: string;
  vote: "Yea" | "Nay" | "Not Voting" | "Present";
  issueSlug: string;
  aligned: boolean;
}

export interface UserIssueTag {
  slug: string;
  label: string;
  weight: number;
}
