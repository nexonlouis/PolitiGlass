export interface ParsedVoteQuestion {
  /** e.g. "On Passage", "On Agreeing to the Resolution, as Amended" */
  procedure: string | null;
  /** e.g. "H.R. 5103" */
  billLabel: string | null;
  /** e.g. "Make the District of Columbia Safe and Beautiful Act" */
  billName: string | null;
}

const BILL_PREFIX =
  /^(H\.?\s*R\.?|S\.?|H\.?\s*RES\.?|H\.?\s*CON\.?\s*RES\.?|S\.?\s*CON\.?\s*RES\.?|H\.?\s*J\.?\s*RES\.?|S\.?\s*J\.?\s*RES\.?)\s*(\d+)\s+(.+)$/i;

/**
 * Parses House/Senate roll-call question text into procedure + bill label + name.
 */
export function parseVoteQuestion(question: string | null | undefined): ParsedVoteQuestion {
  if (!question?.trim()) {
    return { procedure: null, billLabel: null, billName: null };
  }

  const onMatch = question.match(/^On\s+([^:]+):\s*(.+)$/i);
  if (!onMatch) {
    return { procedure: null, billLabel: null, billName: question.trim() };
  }

  const procedure = onMatch[1].trim();
  const remainder = onMatch[2].trim();
  const billMatch = remainder.match(BILL_PREFIX);

  if (!billMatch) {
    return { procedure, billLabel: null, billName: remainder };
  }

  const billLabel = `${billMatch[1].replace(/\s+/g, "").toUpperCase()} ${billMatch[2]}`;
  return {
    procedure,
    billLabel,
    billName: billMatch[3].trim(),
  };
}

export function formatVoteContext(input: {
  procedure?: string | null;
  category?: string | null;
  result?: string | null;
  chamber?: string | null;
}): string | null {
  const parts: string[] = [];

  if (input.chamber) {
    parts.push(input.chamber === "senate" ? "Senate" : "House");
  }
  if (input.procedure) parts.push(input.procedure);
  else if (input.category) parts.push(input.category.replace(/-/g, " "));
  if (input.result) parts.push(input.result);

  return parts.length > 0 ? parts.join(" · ") : null;
}
