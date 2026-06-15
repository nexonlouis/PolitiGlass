import { ALLOWED_ISSUE_SLUGS, filterAllowedSlugs, type IssueSlug } from "./issue-slugs.js";
import type { BillRow } from "./bills-query.js";

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export interface OllamaTagResult {
  slugs: IssueSlug[];
  userPrompt: string;
  rawContent: string;
  rejectedSlugs: string[];
}

export function resolveOllamaConfig(): OllamaConfig {
  return {
    baseUrl: (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, ""),
    model: process.env.OLLAMA_MODEL ?? "gemma4",
    timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? "120000"),
  };
}

export async function assertOllamaModel(config: OllamaConfig): Promise<void> {
  const res = await fetch(`${config.baseUrl}/api/tags`);
  if (!res.ok) {
    throw new Error(
      `Ollama not reachable at ${config.baseUrl} (${res.status}). Start Ollama and run: ollama pull ${config.model}`,
    );
  }

  const body = (await res.json()) as { models?: Array<{ name: string }> };
  const names = (body.models ?? []).map((m) => m.name.split(":")[0]);
  const base = config.model.split(":")[0];

  if (!names.includes(base)) {
    throw new Error(
      `Model "${config.model}" not found in Ollama. Available: ${names.join(", ") || "(none)"}. Run: ollama pull ${config.model}`,
    );
  }
}

function slugListBlock(): string {
  return ALLOWED_ISSUE_SLUGS.map((s) => `- ${s}`).join("\n");
}

/**
 * Congressional bill system prompt: return [] only for clearly procedural bills;
 * substantive bills must get the best available slug(s) from the catalog.
 */
export function buildFederalOllamaSystemPrompt(): string {
  return `You classify U.S. congressional bills into PolitiGlass issue tags for civic engagement scoring.

Allowed issue_slugs (use ONLY these exact strings):
${slugListBlock()}

Step 1 — Decide bill type:
A) PROCEDURAL → return {"issue_slugs":[]}
B) SUBSTANTIVE → return 1 to 3 slugs from the allowed list (never empty)

PROCEDURAL (return empty) — no broad policy issue for voters to align on:
- Chamber rules, previous question, motion to recommit, discharge, or calendar procedure only
- Pure adjournment, recess, joint session, or housekeeping resolutions
- Omnibus appropriations / continuing resolution / debt-limit vehicle with no distinct policy topic
- Naming post offices, congressional gold medals, commemorative or purely honorary resolutions
- Technical corrections, conforming amendments, or codification with no policy change
- Vote stubs where roll-call context is only procedural (e.g. "On Ordering the Previous Question")

SUBSTANTIVE (must tag) — changes federal law or policy voters might care about:
- You MUST return at least 1 issue_slug. Pick the closest allowed slug even if imperfect.
- Use up to 3 tags when multiple areas clearly apply.

Helpful mappings when the fit is indirect:
- Defense, military, NDAA, homeland security → national-security
- Immigration, border, asylum, interior enforcement → border-security
- Income/corporate tax, tariffs, IRS → tax-relief
- Medicare, Medicaid, ACA, FDA, drug pricing → healthcare
- Abortion, contraception, reproductive health → reproductive-rights
- Firearms legislation → gun-rights or gun-regulation (match bill direction)
- Climate, EPA, clean energy, conservation → climate-environment
- Highways, broadband, water projects, transit → infrastructure-transportation
- Ukraine, NATO, foreign aid, treaties, war powers → foreign-policy
- Voting rights, discrimination, civil liberties → civil-rights
- K-12 → public-schools; higher ed / student aid → student-loans
- Policing, sentencing, prisons → criminal-justice-reform or crime-prevention
- AI, privacy, social media, data → tech-regulation or science-technology
- Farm bill, agriculture subsidies → agriculture
- Regulatory rollback / SEC / CFPB deregulation → deregulation
- Labor, unions, minimum wage, OSHA → jobs-labor-rights
- Housing, rent, homelessness → housing-affordability
- Social Security, SNAP, welfare → reducing-poverty
- Small business lending / SBA → small-business
- Spending cuts, deficit, fiscal commissions → less-government-spending

Output:
- JSON only: {"issue_slugs":["slug1"]} or {"issue_slugs":[]}
- Do not invent slugs outside the allowed list
- When substantive, never return an empty list — choose the best available match`;
}

export function buildOllamaUserPrompt(bill: BillRow, voteContext: string | null): string {
  const parts = [
    `bill_id: ${bill.bill_id}`,
    bill.title ? `title: ${bill.title}` : null,
    bill.short_title ? `short_title: ${bill.short_title}` : null,
    bill.summary ? `summary: ${bill.summary.slice(0, 1200)}` : null,
    bill.subjects?.length ? `subjects: ${bill.subjects.join("; ")}` : null,
    voteContext ? `roll_call_context: ${voteContext.slice(0, 1200)}` : null,
  ].filter(Boolean);

  return parts.join("\n");
}

function parseSlugsFromContent(content: string): string[] {
  const trimmed = content.trim();

  try {
    const parsed = JSON.parse(trimmed) as { issue_slugs?: unknown; slugs?: unknown };
    const raw = parsed.issue_slugs ?? parsed.slugs;
    if (Array.isArray(raw)) return raw.map(String);
  } catch {
    // fall through
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      const parsed = JSON.parse(fence[1]) as { issue_slugs?: unknown };
      if (Array.isArray(parsed.issue_slugs)) return parsed.issue_slugs.map(String);
    } catch {
      // fall through
    }
  }

  const arrayMatch = trimmed.match(/\[[\s\S]*?\]/);
  if (arrayMatch) {
    try {
      const arr = JSON.parse(arrayMatch[0]) as unknown[];
      if (Array.isArray(arr)) return arr.map(String);
    } catch {
      // fall through
    }
  }

  return [];
}

export async function tagBillWithOllamaDetailed(
  bill: BillRow,
  voteContext: string | null,
  config: OllamaConfig,
  options?: { systemPrompt?: string },
): Promise<OllamaTagResult> {
  const userPrompt = buildOllamaUserPrompt(bill, voteContext);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const systemContent = options?.systemPrompt ?? buildFederalOllamaSystemPrompt();

  try {
    const res = await fetch(`${config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        stream: false,
        format: "json",
        options: { temperature: 0.1 },
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama ${res.status}: ${text.slice(0, 200)}`);
    }

    const body = (await res.json()) as { message?: { content?: string } };
    const rawContent = body.message?.content ?? "";
    const parsed = parseSlugsFromContent(rawContent);
    const allowed = filterAllowedSlugs(parsed);
    const rejectedSlugs = parsed.filter(
      (s) => !ALLOWED_ISSUE_SLUGS.includes(s as IssueSlug),
    );

    return {
      slugs: allowed.slice(0, 3),
      userPrompt,
      rawContent,
      rejectedSlugs,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function tagBillWithOllama(
  bill: BillRow,
  voteContext: string | null,
  config: OllamaConfig,
): Promise<IssueSlug[]> {
  const result = await tagBillWithOllamaDetailed(bill, voteContext, config);
  return result.slugs;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
