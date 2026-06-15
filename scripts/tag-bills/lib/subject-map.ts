import { filterAllowedSlugs, type IssueSlug } from "./issue-slugs.js";

/**
 * Maps Congressional / LOC legislative subject phrases to PolitiGlass issue slugs.
 * Keys are lowercase; matching also tries substring overlap.
 */
const SUBJECT_TO_SLUGS: Record<string, IssueSlug[]> = {
  health: ["healthcare"],
  "medical care": ["healthcare"],
  medicare: ["healthcare"],
  medicaid: ["healthcare"],
  "public health": ["healthcare"],
  hospitals: ["healthcare"],
  "prescription drugs": ["healthcare"],
  "drug pricing": ["healthcare"],
  "mental health": ["healthcare"],
  "affordable care act": ["healthcare"],
  "health insurance": ["healthcare"],

  education: ["public-schools"],
  "elementary and secondary education": ["public-schools"],
  "secondary education": ["public-schools"],
  "school districts": ["public-schools"],
  teachers: ["public-schools"],
  "special education": ["public-schools"],

  "higher education": ["student-loans", "public-schools"],
  "student aid": ["student-loans"],
  "federal student aid": ["student-loans"],
  "college costs": ["student-loans"],

  "child care": ["childcare"],
  childcare: ["childcare"],
  "family leave": ["childcare"],

  environment: ["climate-environment"],
  "environmental protection": ["climate-environment"],
  "air pollution": ["climate-environment"],
  "water pollution": ["climate-environment"],
  "climate change": ["climate-environment"],
  "greenhouse gases": ["climate-environment"],
  "renewable energy": ["climate-environment"],
  energy: ["climate-environment"],
  wildlife: ["climate-environment"],
  "public lands": ["climate-environment"],

  housing: ["housing-affordability"],
  "rental housing": ["housing-affordability"],
  homelessness: ["housing-affordability"],
  "mortgage loans": ["housing-affordability"],
  "community development": ["housing-affordability"],

  employment: ["jobs-labor-rights"],
  labor: ["jobs-labor-rights"],
  "labor and employment": ["jobs-labor-rights"],
  wages: ["jobs-labor-rights"],
  "economic development": ["jobs-labor-rights", "small-business"],
  "small business": ["small-business", "jobs-labor-rights"],
  unemployment: ["jobs-labor-rights"],
  "job creation": ["jobs-labor-rights", "small-business"],

  taxation: ["tax-relief"],
  "tax administration": ["tax-relief"],
  "income tax": ["tax-relief"],
  "corporate tax": ["tax-relief"],
  tariffs: ["tax-relief", "jobs-labor-rights"],

  immigration: ["border-security"],
  "border security": ["border-security"],
  "foreign labor": ["border-security", "jobs-labor-rights"],
  refugees: ["border-security", "civil-rights"],

  "international affairs": ["foreign-policy"],
  diplomacy: ["foreign-policy"],
  "foreign relations": ["foreign-policy"],
  "war powers": ["foreign-policy"],
  ukraine: ["foreign-policy"],
  nato: ["foreign-policy", "national-security"],

  "national security": ["national-security"],
  "homeland security": ["national-security"],
  military: ["national-security"],
  defense: ["national-security"],
  "armed forces": ["national-security"],
  intelligence: ["national-security"],

  "civil rights": ["civil-rights"],
  "voting rights": ["civil-rights"],
  discrimination: ["civil-rights"],
  "racial discrimination": ["civil-rights"],
  "equal protection": ["civil-rights"],
  "lgbtq rights": ["civil-rights"],

  firearms: ["gun-rights", "gun-regulation"],
  "gun control": ["gun-regulation"],
  "firearms and explosives": ["gun-rights", "gun-regulation"],

  abortion: ["reproductive-rights"],
  "reproductive health": ["reproductive-rights"],
  contraception: ["reproductive-rights"],

  "social security": ["less-government-spending"],
  pensions: ["less-government-spending"],
  retirement: ["less-government-spending"],

  "science and technology": ["science-technology"],
  "information technology": ["science-technology", "tech-regulation"],
  "artificial intelligence": ["science-technology", "tech-regulation"],
  "data protection": ["tech-regulation"],
  privacy: ["tech-regulation"],
  cybersecurity: ["national-security", "tech-regulation"],
  "social media": ["tech-regulation"],

  transportation: ["infrastructure-transportation"],
  highways: ["infrastructure-transportation"],
  railroads: ["infrastructure-transportation"],
  aviation: ["infrastructure-transportation", "national-security"],
  broadband: ["infrastructure-transportation", "science-technology"],
  "water resources": ["infrastructure-transportation", "climate-environment"],
  "public transit": ["infrastructure-transportation"],

  "criminal justice": ["criminal-justice-reform", "crime-prevention"],
  "law enforcement": ["crime-prevention"],
  policing: ["crime-prevention"],
  prisons: ["criminal-justice-reform"],
  sentencing: ["criminal-justice-reform", "crime-prevention"],
  "drug abuse": ["crime-prevention", "healthcare"],
};

/** Title keyword hints when subjects are missing or sparse. */
const TITLE_KEYWORDS: Array<{ pattern: RegExp; label: string; slugs: IssueSlug[] }> = [
  { pattern: /\bhealth\s*care\b|\bmedicare\b|\bmedicaid\b/i, label: "healthcare / medicare / medicaid", slugs: ["healthcare"] },
  { pattern: /\beducation\b|\bschool\b|\bteacher\b/i, label: "education / school / teacher", slugs: ["public-schools"] },
  { pattern: /\bstudent\s+loan\b|\bhigher\s+education\b/i, label: "student loan / higher education", slugs: ["student-loans"] },
  { pattern: /\bchild\s*care\b|\bchildcare\b/i, label: "childcare", slugs: ["childcare"] },
  { pattern: /\bclimate\b|\benvironment\b|\bclean\s+energy\b/i, label: "climate / environment / clean energy", slugs: ["climate-environment"] },
  { pattern: /\bhousing\b|\brent\b|\bhomeless/i, label: "housing / rent / homeless", slugs: ["housing-affordability"] },
  { pattern: /\bjob\b|\bemploy\b|\blabor\b|\bwage\b/i, label: "jobs / employment / labor / wages", slugs: ["jobs-labor-rights"] },
  { pattern: /\btax\b|\btariff\b/i, label: "tax / tariff", slugs: ["tax-relief"] },
  { pattern: /\bimmigrat\b|\bborder\b|\basylum\b/i, label: "immigration / border / asylum", slugs: ["border-security"] },
  { pattern: /\bcivil\s+rights\b|\bvoting\s+rights\b/i, label: "civil / voting rights", slugs: ["civil-rights"] },
  { pattern: /\bgun\b|\bfirearm\b|\bsecond\s+amendment\b/i, label: "gun / firearm", slugs: ["gun-rights", "gun-regulation"] },
  { pattern: /\babortion\b|\breproductive\b/i, label: "abortion / reproductive", slugs: ["reproductive-rights"] },
  { pattern: /\bsocial\s+security\b|\bpension\b|\bretire/i, label: "social security / pension / retirement", slugs: ["less-government-spending"] },
  { pattern: /\bprivacy\b|\bcyber\b|\bartificial\s+intelligence\b|\bai\b/i, label: "privacy / cyber / AI", slugs: ["science-technology", "tech-regulation"] },
  { pattern: /\binfrastructure\b|\bhighway\b|\bbroadband\b|\btransit\b/i, label: "infrastructure / transit / broadband", slugs: ["infrastructure-transportation"] },
  { pattern: /\bcriminal\b|\bpolice\b|\bprison\b|\bsentenc/i, label: "criminal justice / policing", slugs: ["crime-prevention", "criminal-justice-reform"] },
  { pattern: /\bukraine\b|\bwar\s+powers\b|\bnato\b|\bforeign\s+aid\b|\btreaty\b/i, label: "foreign policy / war powers", slugs: ["foreign-policy"] },
  { pattern: /\bdefense\b|\bmilitary\b|\barmed\s+forces\b|\bhomeland\s+security\b/i, label: "defense / national security", slugs: ["national-security"] },
  { pattern: /\bagricultur\b|\bfarm\b/i, label: "agriculture / farm", slugs: ["agriculture"] },
  { pattern: /\bfood\s+and\s+drug\b/i, label: "FDA", slugs: ["healthcare"] },
  { pattern: /\bappropriat/i, label: "appropriations", slugs: ["less-government-spending"] },
];

function normalizeSubject(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

export interface TagMatch {
  slug: IssueSlug;
  source: "subject" | "title";
  rule: string;
  sourceText: string;
}

function matchSubjectDetailed(subject: string): TagMatch[] {
  const normalized = normalizeSubject(subject);
  const matches: TagMatch[] = [];

  const direct = SUBJECT_TO_SLUGS[normalized];
  if (direct) {
    for (const slug of direct) {
      matches.push({
        slug,
        source: "subject",
        rule: `exact subject map "${normalized}"`,
        sourceText: subject,
      });
    }
    return matches;
  }

  for (const [key, slugs] of Object.entries(SUBJECT_TO_SLUGS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      for (const slug of slugs) {
        matches.push({
          slug,
          source: "subject",
          rule: `subject overlaps "${key}"`,
          sourceText: subject,
        });
      }
    }
  }

  return matches;
}

function matchTitleDetailed(text: string): TagMatch[] {
  const matches: TagMatch[] = [];

  for (const { pattern, label, slugs } of TITLE_KEYWORDS) {
    const hit = text.match(pattern);
    if (!hit) continue;

    for (const slug of slugs) {
      matches.push({
        slug,
        source: "title",
        rule: `keyword "${label}"`,
        sourceText: hit[0],
      });
    }
  }

  return matches;
}

export interface BillTagInput {
  title: string | null;
  short_title?: string | null;
  subjects: string[] | null;
  voteContext?: string | null;
}

export interface TagInferenceResult {
  slugs: IssueSlug[];
  matches: TagMatch[];
  maxSlugs: number;
  input: BillTagInput;
}

function dedupeMatches(matches: TagMatch[]): TagMatch[] {
  const seen = new Set<string>();
  const out: TagMatch[] = [];

  for (const m of matches) {
    const key = `${m.slug}|${m.source}|${m.rule}|${m.sourceText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }

  return out;
}

/**
 * Infer issue slugs with per-tag match explanations (subjects first, then title/vote text).
 */
export function inferIssueSlugsDetailed(bill: BillTagInput, maxSlugs = 3): TagInferenceResult {
  const subjectMatches: TagMatch[] = [];
  for (const subject of bill.subjects ?? []) {
    subjectMatches.push(...matchSubjectDetailed(subject));
  }

  const combinedTitleText = [bill.short_title, bill.title, bill.voteContext].filter(Boolean).join(" ");
  const titleMatches = combinedTitleText ? matchTitleDetailed(combinedTitleText) : [];

  const orderedSlugs: string[] = [];
  const allMatches = dedupeMatches([...subjectMatches, ...titleMatches]);

  for (const m of allMatches) {
    if (!orderedSlugs.includes(m.slug)) orderedSlugs.push(m.slug);
  }

  const slugs = filterAllowedSlugs(orderedSlugs).slice(0, maxSlugs);
  const keptMatches = allMatches.filter((m) => slugs.includes(m.slug));

  return {
    slugs,
    matches: keptMatches,
    maxSlugs,
    input: bill,
  };
}

/**
 * Infer issue slugs from bill metadata using subject vocabulary + title keywords.
 */
export function inferIssueSlugs(bill: BillTagInput, maxSlugs = 3): IssueSlug[] {
  return inferIssueSlugsDetailed(bill, maxSlugs).slugs;
}
