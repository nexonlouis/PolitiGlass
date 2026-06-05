#!/usr/bin/env npx tsx
/**
 * Batch-tag bills.issue_slugs from subjects + title keywords.
 * Run after congress ingest. Does not call external LLM APIs.
 */

import "dotenv/config";
import { createAdminClient } from "../ingest-congress/lib/supabase-admin.js";
import {
  fetchBills,
  fetchVoteContextByBill,
  fetchVoteLinkedBillIds,
} from "./lib/bills-query.js";
import { inferIssueSlugsDetailed } from "./lib/subject-map.js";
import { printSubjectMapReport } from "./lib/tag-report.js";

interface CliOptions {
  dryRun: boolean;
  all: boolean;
  limit?: number;
  force: boolean;
  quiet: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = { dryRun: false, all: false, force: false, quiet: false };

  for (const a of args) {
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--all") opts.all = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--quiet") opts.quiet = true;
    else if (a.startsWith("--limit=")) opts.limit = Number(a.split("=")[1]);
  }

  return opts;
}

async function main() {
  const opts = parseArgs();
  const supabase = createAdminClient();

  const billIds = opts.all ? null : await fetchVoteLinkedBillIds(supabase);
  let bills = await fetchBills(supabase, billIds, opts.force);

  if (opts.limit) bills = bills.slice(0, opts.limit);

  const voteContext = await fetchVoteContextByBill(
    supabase,
    bills.map((b) => b.bill_id),
  );

  const explain = opts.dryRun && !opts.quiet;

  console.log(
    `Tagging ${bills.length} bill(s) (${opts.all ? "all untagged" : "vote-linked only"})${opts.dryRun ? " [dry-run]" : ""}${explain ? " — showing tag decisions" : ""}`,
  );

  let tagged = 0;
  let skipped = 0;
  let errors = 0;

  for (const bill of bills) {
    const context = voteContext.get(bill.bill_id) ?? null;
    const result = inferIssueSlugsDetailed({
      title: bill.title,
      short_title: bill.short_title,
      subjects: bill.subjects,
      voteContext: context,
    });

    if (explain) {
      printSubjectMapReport(bill.bill_id, result, context);
    }

    if (result.slugs.length === 0) {
      skipped++;
      if (!explain && skipped <= 5) {
        const hint = bill.title?.slice(0, 60) ?? context?.slice(0, 60) ?? "(no title)";
        console.log("[skip]", bill.bill_id, hint);
      }
      continue;
    }

    if (opts.dryRun) {
      if (!explain) {
        const hint = bill.title?.slice(0, 50) ?? context?.slice(0, 50);
        console.log("[dry-run]", bill.bill_id, "→", result.slugs.join(", "), "|", hint);
      }
      tagged++;
      continue;
    }

    const { error } = await supabase
      .from("bills")
      .update({ issue_slugs: result.slugs })
      .eq("bill_id", bill.bill_id);

    if (error) {
      errors++;
      if (errors <= 5) console.error("[error]", bill.bill_id, error.message);
      continue;
    }

    tagged++;
    if (!explain && tagged <= 10) {
      console.log("[tagged]", bill.bill_id, "→", result.slugs.join(", "));
    }
  }

  console.log(`Done. tagged=${tagged} skipped=${skipped} errors=${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
