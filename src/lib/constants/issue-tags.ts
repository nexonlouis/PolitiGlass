export interface IssueTagDefinition {
  slug: string;
  label: string;
  description: string;
  /** Tags with aligned sentiment — highlighted when this tag is selected. */
  pro?: string[];
  /** Tags with opposing sentiment — highlighted when this tag is selected. */
  anti?: string[];
}

/**
 * Curated issue tags for onboarding and bill classification.
 * Keep in sync with scripts/tag-bills (imports this file).
 * Order = default popularity (most common near the top).
 * Users pick 3–8; selecting a tag highlights related pro/anti tags.
 */
export const ISSUE_TAGS: IssueTagDefinition[] = [
  {
    slug: "jobs-labor-rights",
    label: "Jobs / Labor Rights",
    description: "Wages, collective bargaining, and job creation",
    pro: ["housing-affordability", "poverty", "student-loans", "training-programs"],
    anti: ["deregulation", "tax-relief", "small-business", "less-government-spending"],
  },
  {
    slug: "border-security",
    label: "Border Security",
    description: "Border security and immigration enforcement",
    pro: ["crime-prevention", "national-security"],
    anti: ["foreign-policy"],
  },
  {
    slug: "tax-relief",
    label: "Tax Relief",
    description: "Lower taxes",
    pro: ["less-government-spending", "deregulation", "small-business"],
    anti: ["jobs-labor-rights"],
  },
  {
    slug: "crime-prevention",
    label: "Crime Prevention",
    description: "Crime prevention, punishment, law and order",
    pro: ["gun-rights", "border-security"],
    anti: ["criminal-justice-reform", "civil-rights"],
  },
  {
    slug: "housing-affordability",
    label: "Affordable Housing",
    description: "Rent, home prices, and zoning",
    pro: ["jobs-labor-rights", "student-loans", "training-programs"],
    anti: ["less-government-spending", "tax-relief"],
  },
  {
    slug: "foreign-policy",
    label: "Foreign Policy",
    description: "Diplomacy, alliances, foreign aid, and limited war powers",
    anti: ["national-security", "border-security"],
  },
  {
    slug: "small-business",
    label: "Small Business",
    description: "Support for small businesses and entrepreneurship",
    pro: ["deregulation", "tax-relief", "less-government-spending"],
    anti: ["jobs-labor-rights"],
  },
  {
    slug: "deregulation",
    label: "Deregulation",
    description: "Reducing government regulations on businesses and investments",
    pro: ["small-business", "tax-relief", "less-government-spending"],
    anti: ["jobs-labor-rights", "tech-regulation"],
  },
  {
    slug: "national-security",
    label: "National Security",
    description: "Defense, military, and homeland security",
    pro: ["border-security"],
    anti: ["foreign-policy"],
  },
  {
    slug: "gun-rights",
    label: "Gun Rights",
    description: "Right to bear arms and self-defense",
    pro: ["crime-prevention", "border-security"],
    anti: ["gun-regulation", "criminal-justice-reform"],
  },
  {
    slug: "criminal-justice-reform",
    label: "Criminal Justice Reform",
    description: "Policing, sentencing reform, mass incarceration",
    pro: ["civil-rights", "gun-regulation", "poverty"],
    anti: ["crime-prevention"],
  },
  {
    slug: "gun-regulation",
    label: "Gun Regulation",
    description: "Firearms regulation and safety",
    anti: ["gun-rights"],
  },
  {
    slug: "civil-rights",
    label: "Civil Rights",
    description: "Voting rights, equal protection and diversity",
    pro: ["criminal-justice-reform", "reproductive-rights", "poverty"],
    anti: ["crime-prevention"],
  },
  {
    slug: "less-government-spending",
    label: "Less Government Spending",
    description: "Less government spending, national debt, and fiscal policy",
    pro: ["deregulation", "small-business", "tax-relief"],
    anti: ["jobs-labor-rights", "poverty", "student-loans", "training-programs", "housing-affordability"],
  },
  {
    slug: "reducing-poverty",
    label: "Reducing Poverty",
    description: "Welfare, food insecurity, homelessness, and social security",
    pro: [
      "housing-affordability",
      "healthcare",
      "student-loans",
      "training-programs",
      "jobs-labor-rights",
      "criminal-justice-reform",
      "civil-rights",
    ],
    anti: ["crime-prevention", "tax-relief", "less-government-spending"],
  },
  {
    slug: "training-programs",
    label: "Training Programs",
    description: "Job training and workforce development",
    pro: ["jobs-labor-rights", "student-loans", "housing-affordability"],
    anti: ["tax-relief", "less-government-spending"],
  },
  {
    slug: "healthcare",
    label: "Healthcare",
    description: "Access, costs, and insurance policy",
    pro: ["poverty", "reproductive-rights"],
    anti: ["tax-relief", "less-government-spending"],
  },
  {
    slug: "student-loans",
    label: "Student Loans",
    description: "Higher education debt and aid",
    pro: ["public-schools", "training-programs"],
    anti: ["tax-relief", "less-government-spending"],
  },
  {
    slug: "science-technology",
    label: "Science & Technology",
    description: "Research, innovation, AI, space, and technology policy",
    pro: ["climate-environment"],
  },
  {
    slug: "tech-regulation",
    label: "Tech Regulation",
    description: "AI, data centers, social media, and platform regulation",
    pro: ["jobs-labor-rights"],
    anti: ["tax-relief", "deregulation"],
  },
  {
    slug: "climate-environment",
    label: "Climate & Environment",
    description: "Green energy, emissions, and conservation",
    pro: ["science-technology", "tech-regulation"],
    anti: ["tax-relief", "deregulation"],
  },
  {
    slug: "nuclear-energy",
    label: "Nuclear Energy",
    description: "Nuclear power and nuclear waste",
    pro: ["science-technology", "climate-environment", "deregulation"],
  },
  {
    slug: "reproductive-rights",
    label: "Reproductive Rights",
    description: "Healthcare access and reproductive law",
    pro: ["healthcare", "civil-rights"],
  },
  {
    slug: "childcare",
    label: "Childcare",
    description: "Family care costs and credits",
    pro: ["public-schools"],
    anti: ["tax-relief", "less-government-spending"],
  },
  {
    slug: "public-schools",
    label: "Public Schools",
    description: "K-12 funding and education policy",
    pro: ["childcare"],
    anti: ["tax-relief", "less-government-spending"],
  },
  {
    slug: "agriculture",
    label: "Agriculture",
    description: "Food, farming, and agriculture policy",
    pro: ["small-business"],
    anti: ["tax-relief", "less-government-spending"],
  },
  {
    slug: "arts-culture",
    label: "Arts & Culture",
    description: "Art, music, and culture policy",
    anti: ["tax-relief", "less-government-spending"],
  },
  {
    slug: "infrastructure-transportation",
    label: "Infrastructure & Transportation",
    description: "Transportation, infrastructure, and public works",
    pro: ["small-business", "jobs-labor-rights", "housing-affordability"],
    anti: ["tax-relief", "less-government-spending"],
  },
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
