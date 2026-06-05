#!/usr/bin/env npx tsx
/**
 * Tag bills via local Ollama (default model: gemma4).
 * Use --force to re-tag all vote-linked bills (e.g. overnight full LLM pass).
 */

import "dotenv/config";
import { createAdminClient } from "../ingest-congress/lib/supabase-admin.js";
import {
  fetchBills,
  fetchVoteContextByBill,
  fetchVoteLinkedBillIds,
} from "./lib/bills-query.js";
import {
  assertOllamaModel,
  resolveOllamaConfig,
  sleep,
  tagBillWithOllamaDetailed,
} from "./lib/ollama-client.js";
import { printOllamaReport } from "./lib/tag-report.js";

interface CliOptions {
  dryRun: boolean;
  all: boolean;
  force: boolean;
  limit?: number;
  delayMs: number;
  model?: string;
  quiet: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = {
    dryRun: false,
    all: false,
    force: false,
    delayMs: 250,
    quiet: false,
  };

  for (const a of args) {
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--all") opts.all = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--quiet") opts.quiet = true;
    else if (a.startsWith("--limit=")) opts.limit = Number(a.split("=")[1]);
    else if (a.startsWith("--delay-ms=")) opts.delayMs = Number(a.split("=")[1]);
    else if (a.startsWith("--model=")) opts.model = a.split("=")[1];
  }

  return opts;
}

async function main() {
  const opts = parseArgs();
  const config = resolveOllamaConfig();
  if (opts.model) config.model = opts.model;

  await assertOllamaModel(config);

  const supabase = createAdminClient();
  const billIds = opts.all ? null : await fetchVoteLinkedBillIds(supabase);
  let bills = await fetchBills(supabase, billIds, opts.force);

  if (opts.limit) bills = bills.slice(0, opts.limit);

  const voteContext = await fetchVoteContextByBill(
    supabase,
    bills.map((b) => b.bill_id),
  );

  const explain = opts.dryRun && !opts.quiet;
  const scope = opts.all ? "all" : "vote-linked";
  const filter = opts.force ? "including already tagged" : "untagged only";

  console.log(
    `Ollama tagging ${bills.length} bill(s) with ${config.model} (${scope}, ${filter})${opts.dryRun ? " [dry-run]" : ""}${explain ? " — showing model input + response" : ""}`,
  );

  let tagged = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < bills.length; i++) {
    const bill = bills[i];
    const context = voteContext.get(bill.bill_id) ?? null;

    try {
      const result = await tagBillWithOllamaDetailed(bill, context, config);

      if (explain) {
        printOllamaReport(bill.bill_id, result, config.model);
      }

      if (result.slugs.length === 0) {
        skipped++;
        if (!explain && skipped <= 5) {
          const hint = bill.title?.slice(0, 50) ?? context?.slice(0, 50) ?? bill.bill_id;
          console.log("[skip]", bill.bill_id, hint);
        }
      } else if (opts.dryRun) {
        tagged++;
        if (!explain) {
          const hint = bill.title?.slice(0, 50) ?? context?.slice(0, 50);
          console.log("[dry-run]", bill.bill_id, "→", result.slugs.join(", "), "|", hint);
        }
      } else {
        const { error } = await supabase
          .from("bills")
          .update({ issue_slugs: result.slugs })
          .eq("bill_id", bill.bill_id);

        if (error) throw new Error(error.message);

        tagged++;
        if (!explain && tagged <= 10) {
          console.log("[tagged]", bill.bill_id, "→", result.slugs.join(", "));
        }
      }
    } catch (e) {
      errors++;
      const msg = e instanceof Error ? e.message : String(e);
      if (errors <= 5) console.error("[error]", bill.bill_id, msg);
    }

    if (i < bills.length - 1 && opts.delayMs > 0 && !opts.dryRun) {
      await sleep(opts.delayMs);
    } else if (i < bills.length - 1 && opts.delayMs > 0 && opts.dryRun) {
      await sleep(Math.min(opts.delayMs, 100));
    }

    if (!explain && (i + 1) % 25 === 0) {
      console.log(`… progress ${i + 1}/${bills.length}`);
    }
  }

  console.log(`Done. tagged=${tagged} skipped=${skipped} errors=${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
