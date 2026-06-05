import type { createAdminClient } from "../../ingest-congress/lib/supabase-admin.js";

type Supabase = ReturnType<typeof createAdminClient>;

export interface BillRow {
  bill_id: string;
  title: string | null;
  short_title: string | null;
  summary: string | null;
  subjects: string[] | null;
  issue_slugs: string[] | null;
}

export function isUntagged(slugs: string[] | null | undefined): boolean {
  return !slugs || slugs.length === 0;
}

export async function fetchVoteLinkedBillIds(supabase: Supabase): Promise<string[]> {
  const ids = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("roll_call_votes")
      .select("related_bill_id")
      .not("related_bill_id", "is", null)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`roll_call_votes: ${error.message}`);
    if (!data?.length) break;

    for (const row of data) {
      if (row.related_bill_id) ids.add(row.related_bill_id);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return [...ids];
}

export async function fetchBills(
  supabase: Supabase,
  billIds: string[] | null,
  force: boolean,
): Promise<BillRow[]> {
  const pageSize = 500;
  const out: BillRow[] = [];

  if (billIds && billIds.length === 0) return out;

  const select =
    "bill_id, title, short_title, summary, subjects, issue_slugs";

  if (billIds) {
    for (let i = 0; i < billIds.length; i += pageSize) {
      const chunk = billIds.slice(i, i + pageSize);
      const { data, error } = await supabase.from("bills").select(select).in("bill_id", chunk);

      if (error) throw new Error(`bills: ${error.message}`);
      for (const row of (data ?? []) as BillRow[]) {
        if (force || isUntagged(row.issue_slugs)) out.push(row);
      }
    }
    return out;
  }

  let from = 0;
  while (true) {
    const { data, error } = await supabase.from("bills").select(select).range(from, from + pageSize - 1);

    if (error) throw new Error(`bills: ${error.message}`);
    if (!data?.length) break;

    for (const row of data as BillRow[]) {
      if (force || isUntagged(row.issue_slugs)) out.push(row);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return out;
}

export async function fetchVoteContextByBill(
  supabase: Supabase,
  billIds: string[],
): Promise<Map<string, string>> {
  const context = new Map<string, string>();
  const pageSize = 200;

  for (let i = 0; i < billIds.length; i += pageSize) {
    const chunk = billIds.slice(i, i + pageSize);
    const { data, error } = await supabase
      .from("roll_call_votes")
      .select("related_bill_id, question, vote_type")
      .in("related_bill_id", chunk);

    if (error) throw new Error(`vote context: ${error.message}`);

    for (const row of data ?? []) {
      if (!row.related_bill_id) continue;
      const piece = [row.question, row.vote_type].filter(Boolean).join(" ");
      const prev = context.get(row.related_bill_id) ?? "";
      if (!prev.includes(piece)) {
        context.set(row.related_bill_id, `${prev} ${piece}`.trim());
      }
    }
  }

  return context;
}
