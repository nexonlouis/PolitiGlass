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

function buildSystemPrompt(): string {
  const slugList = ALLOWED_ISSUE_SLUGS.map((s) => `- ${s}`).join("\n");
  return `You classify U.S. congressional bills into CivicMirror issue tags for civic engagement scoring.

Allowed issue_slugs (use ONLY these exact strings):
${slugList}

Rules:
- Return JSON only: {"issue_slugs":["slug1"]}
- Pick 0 to 3 tags that best match the bill's substantive policy area
- Return {"issue_slugs":[]} for purely procedural bills (rules, previous question, discharge motions with no policy topic)
- Do not invent slugs outside the allowed list
- Prefer substantive policy over procedural framing`;
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
): Promise<OllamaTagResult> {
  const userPrompt = buildOllamaUserPrompt(bill, voteContext);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

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
          { role: "system", content: buildSystemPrompt() },
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
