import type { CongressBillMetadata } from "@/lib/external/congress-bills";
import {
  formatVoteContext,
  parseVoteQuestion,
  type ParsedVoteQuestion,
} from "@/lib/legislation/vote-question";

export interface BillRowMetadata {
  title: string | null;
  short_title: string | null;
  summary: string | null;
}

export interface VoteDisplayFields {
  title: string;
  summary: string | null;
  voteContext: string | null;
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isSameText(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function buildVoteDisplayFields(input: {
  billId: string;
  voteId: string;
  question: string | null;
  category: string | null;
  result: string | null;
  chamber: string | null;
  bill?: BillRowMetadata | null;
  congress?: CongressBillMetadata | null;
}): VoteDisplayFields {
  const parsed = parseVoteQuestion(input.question);
  const billTitle =
    normalizeText(input.bill?.short_title) ??
    normalizeText(input.bill?.title) ??
    normalizeText(input.congress?.title);

  const title =
    billTitle ??
    normalizeText(parsed.billName) ??
    normalizeText(input.question) ??
    `Roll call ${input.voteId}`;

  const rawSummary =
    normalizeText(input.bill?.summary) ?? normalizeText(input.congress?.summary);

  const summary =
    rawSummary && !isSameText(rawSummary, title) && !isSameText(rawSummary, parsed.billName)
      ? rawSummary
      : null;

  const voteContext =
    summary === null
      ? formatVoteContext({
          procedure: parsed.procedure,
          category: input.category,
          result: input.result,
          chamber: input.chamber,
        })
      : null;

  return { title, summary, voteContext };
}

export { parseVoteQuestion, type ParsedVoteQuestion };
