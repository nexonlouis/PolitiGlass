export interface IssueTagDefinition {
  slug: string;
  label: string;
  description: string;
}

/**
 * Curated issue tags for onboarding and bill classification.
 * Keep in sync with scripts/tag-bills (imports this file).
 * Users pick 3–8; the full list should stay focused (~20 max).
 */
export const ISSUE_TAGS: IssueTagDefinition[] = [
  { slug: "healthcare", label: "Healthcare", description: "Access, costs, and insurance policy" },
  { slug: "public-schools", label: "Public Schools", description: "K-12 funding and education policy" },
  { slug: "student-loans", label: "Student Loans", description: "Higher education debt and aid" },
  { slug: "childcare", label: "Childcare", description: "Family care costs and credits" },
  { slug: "economy-jobs", label: "Economy & Jobs", description: "Employment, wages, and business policy" },
  { slug: "tax-policy", label: "Tax Policy", description: "Federal and state tax changes" },
  { slug: "housing-affordability", label: "Housing", description: "Rent, home prices, and zoning" },
  { slug: "infrastructure", label: "Infrastructure", description: "Roads, transit, and broadband" },
  { slug: "climate-environment", label: "Climate & Environment", description: "Energy, emissions, and conservation" },
  { slug: "immigration", label: "Immigration", description: "Border and immigration reform" },
  { slug: "foreign-policy", label: "Foreign Policy", description: "Diplomacy, alliances, aid, and war powers" },
  { slug: "national-security", label: "National Security", description: "Defense, military, and homeland security" },
  { slug: "civil-rights", label: "Civil Rights", description: "Voting rights and equal protection" },
  { slug: "criminal-justice", label: "Criminal Justice", description: "Policing and sentencing reform" },
  { slug: "gun-policy", label: "Gun Policy", description: "Firearms regulation and safety" },
  { slug: "reproductive-rights", label: "Reproductive Rights", description: "Healthcare access and related law" },
  { slug: "retirement-security", label: "Retirement", description: "Social Security and pensions" },
  { slug: "tech-privacy", label: "Tech & Privacy", description: "AI, data, and platform regulation" },
];

export const ISSUE_TAG_SLUGS = ISSUE_TAGS.map((t) => t.slug);

export const EDUCATION_LEVELS = [
  "high_school",
  "some_college",
  "associates",
  "bachelors",
  "graduate",
  "prefer_not_to_say",
] as const;

export const INCOME_BRACKETS = [
  "under_25k",
  "25k_50k",
  "50k_100k",
  "100k_150k",
  "over_150k",
  "prefer_not_to_say",
] as const;

export function getIssueTagLabel(slug: string): string {
  return ISSUE_TAGS.find((t) => t.slug === slug)?.label ?? slug;
}
