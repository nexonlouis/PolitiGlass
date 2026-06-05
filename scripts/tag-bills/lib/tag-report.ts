import type { BillTagInput } from "./subject-map.js";
import type { TagInferenceResult } from "./subject-map.js";
import type { OllamaTagResult } from "./ollama-client.js";
import type { BillRow } from "./bills-query.js";

const DIVIDER = "─".repeat(72);

export function formatBillInputFields(
  bill: BillRow | BillTagInput,
  voteContext: string | null,
): string[] {
  const lines: string[] = [];
  const row = bill as BillRow;

  if (bill.title) lines.push(`title: ${bill.title}`);
  if (bill.short_title) lines.push(`short_title: ${bill.short_title}`);
  if (row.summary) lines.push(`summary: ${row.summary.slice(0, 800)}`);
  if (bill.subjects?.length) lines.push(`subjects: ${bill.subjects.join("; ")}`);
  if (voteContext) lines.push(`roll_call_context: ${voteContext.slice(0, 800)}`);

  if (lines.length === 0) lines.push("(no title, subjects, or roll-call context)");
  return lines;
}

export function formatSubjectMapReport(
  billId: string,
  result: TagInferenceResult,
  voteContext: string | null,
): string {
  const lines: string[] = [
    DIVIDER,
    `bill_id: ${billId}`,
    `method: subject-map (congressional subjects + title/vote keywords)`,
    `issue_slugs: ${result.slugs.length ? result.slugs.join(", ") : "(none)"}`,
    "",
    "Input text:",
    ...formatBillInputFields(result.input, voteContext).map((l) => `  ${l}`),
  ];

  if (result.matches.length > 0) {
    lines.push("", "Tag decisions:");
    for (const m of result.matches) {
      const kept = result.slugs.includes(m.slug) ? "✓" : "·";
      lines.push(
        `  ${kept} ${m.slug}`,
        `      via ${m.source}: ${m.rule}`,
        `      from: "${m.sourceText}"`,
      );
    }
    const dropped = result.matches.filter((m) => !result.slugs.includes(m.slug));
    if (dropped.length > 0) {
      lines.push(
        "",
        `  (${dropped.length} match(es) beyond max ${result.maxSlugs} not included)`,
      );
    }
  } else {
    lines.push("", "Tag decisions: (no subject or keyword matches)");
  }

  return lines.join("\n");
}

export function formatOllamaReport(
  billId: string,
  result: OllamaTagResult,
  model: string,
): string {
  const lines: string[] = [
    DIVIDER,
    `bill_id: ${billId}`,
    `method: ollama (${model})`,
    `issue_slugs: ${result.slugs.length ? result.slugs.join(", ") : "(none)"}`,
    "",
    "Input text (sent to model):",
    ...result.userPrompt.split("\n").map((l) => `  ${l}`),
    "",
    "Model response:",
    `  ${result.rawContent.trim() || "(empty)"}`,
  ];

  if (result.rejectedSlugs.length > 0) {
    lines.push("", `Rejected (not in allowed list): ${result.rejectedSlugs.join(", ")}`);
  }

  return lines.join("\n");
}

export function printSubjectMapReport(
  billId: string,
  result: TagInferenceResult,
  voteContext: string | null,
): void {
  console.log(formatSubjectMapReport(billId, result, voteContext));
}

export function printOllamaReport(billId: string, result: OllamaTagResult, model: string): void {
  console.log(formatOllamaReport(billId, result, model));
}
