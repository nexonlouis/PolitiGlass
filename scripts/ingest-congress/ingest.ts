#!/usr/bin/env npx tsx
/**
 * CivicMirror — ingest unitedstates/congress JSON into Supabase.
 *
 * Outline implementation: parsing + upsert logic are complete; run with
 * --dry-run first. See README.md and docs/design/congress-vote-ingestion.md.
 */

import "dotenv/config";
import path from "node:path";
import { createAdminClient } from "./lib/supabase-admin.js";
import {
  flattenVotePositions,
  normalizeBillRow,
  normalizeVoteRow,
} from "./lib/normalize.js";
import {
  diagnoseDataLayout,
  readJsonFile,
  resolveDataRoot,
  walkBillFiles,
  walkVoteFiles,
} from "./lib/walk-data.js";
import type { UscBillFile } from "./types/usc-bill.js";
import type { UscVoteFile } from "./types/usc-vote.js";

interface CliOptions {
  congress: number;
  dryRun: boolean;
  votesOnly: boolean;
  billsOnly: boolean;
  diagnose: boolean;
  sessions?: string[];
  limit?: number;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = {
    congress: Number(process.env.INGEST_CONGRESS ?? "119"),
    dryRun: false,
    votesOnly: false,
    billsOnly: false,
    diagnose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--diagnose") opts.diagnose = true;
    else if (a === "--votes-only") opts.votesOnly = true;
    else if (a === "--bills-only") opts.billsOnly = true;
    else if (a.startsWith("--congress=")) opts.congress = Number(a.split("=")[1]);
    else if (a === "--congress") opts.congress = Number(args[++i]);
    else if (a.startsWith("--sessions="))
      opts.sessions = a.split("=")[1].split(",");
    else if (a.startsWith("--limit=")) opts.limit = Number(a.split("=")[1]);
  }

  return opts;
}

async function startIngestRun(supabase: ReturnType<typeof createAdminClient>, congress: number) {
  const { data, error } = await supabase
    .from("ingest_runs")
    .insert({
      congress,
      mode: "full",
      status: "running",
    })
    .select("id")
    .single();

  if (error) throw new Error(`ingest_runs insert: ${error.message}`);
  return data.id as string;
}

async function finishIngestRun(
  supabase: ReturnType<typeof createAdminClient>,
  runId: string,
  patch: Record<string, unknown>,
) {
  await supabase
    .from("ingest_runs")
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq("id", runId);
}

async function ingestBills(
  supabase: ReturnType<typeof createAdminClient> | null,
  dataDir: string,
  congress: number,
  dryRun: boolean,
  limit?: number,
) {
  let processed = 0;
  let upserted = 0;
  let errors = 0;

  for await (const filePath of walkBillFiles(dataDir, congress)) {
    if (limit && processed >= limit) break;
    processed++;

    try {
      const raw = await readJsonFile<UscBillFile>(filePath);
      const row = normalizeBillRow(raw);

      if (dryRun) {
        if (processed <= 3) console.log("[dry-run bill]", row.bill_id, row.title);
        upserted++;
        continue;
      }

      const { error } = await supabase!.from("bills").upsert(row, { onConflict: "bill_id" });
      if (error) throw error;
      upserted++;
    } catch (e) {
      errors++;
      if (errors <= 5) console.error("bill error:", filePath, e);
    }
  }

  return { processed, upserted, errors };
}

async function ingestVotes(
  supabase: ReturnType<typeof createAdminClient> | null,
  dataDir: string,
  congress: number,
  dryRun: boolean,
  sessions?: string[],
  limit?: number,
) {
  let processed = 0;
  let upserted = 0;
  let errors = 0;

  for await (const filePath of walkVoteFiles(dataDir, congress, sessions)) {
    if (limit && processed >= limit) break;
    processed++;

    try {
      const raw = await readJsonFile<UscVoteFile>(filePath);
      if (!raw.vote_id) {
        throw new Error("missing vote_id");
      }

      const voteRow = normalizeVoteRow(raw);
      const positions = flattenVotePositions(raw.votes);

      if (dryRun) {
        if (processed <= 3) {
          console.log(
            "[dry-run vote]",
            voteRow.vote_id,
            positions.length,
            "positions",
            voteRow.related_bill_id,
          );
        }
        upserted++;
        continue;
      }

      // Ensure related bill stub exists when vote references a bill
      if (voteRow.related_bill_id && raw.bill) {
        const billStub = normalizeBillRow({
          bill_type: raw.bill.type,
          number: raw.bill.number,
          congress: raw.bill.congress,
        });
        await supabase!.from("bills").upsert(billStub, { onConflict: "bill_id" });
      }

      const { error: voteError } = await supabase!
        .from("roll_call_votes")
        .upsert(voteRow, { onConflict: "vote_id" });

      if (voteError) throw voteError;

      // Replace positions atomically per vote
      await supabase!.from("roll_call_positions").delete().eq("vote_id", voteRow.vote_id);

      if (positions.length > 0) {
        const { error: posError } = await supabase!.from("roll_call_positions").insert(
          positions.map((p) => ({
            vote_id: voteRow.vote_id,
            bioguide_id: p.bioguideId,
            position: p.position,
            party: p.party,
            state: p.state,
          })),
        );
        if (posError) throw posError;
      }

      upserted++;
    } catch (e) {
      errors++;
      if (errors <= 5) console.error("vote error:", filePath, e);
    }

    if (processed % 100 === 0) {
      console.log(`… votes processed ${processed}`);
    }
  }

  return { processed, upserted, errors };
}

function printScrapeInstructions(congressRepoHint: string) {
  console.log(`
No scraped JSON found. Generate data with unitedstates/congress first:

  cd ${congressRepoHint}
  source env/bin/activate
  ./run votes --congress=119
  ./run bills --congress=119

Expected layout after scraping:
  data/119/votes/2026/h1/data.json   (year = session name, varies)
  data/119/bills/hr/hr1/data.json

Then set CONGRESS_DATA_DIR to the 'data' folder (or the congress repo root).
`);
}

async function main() {
  const opts = parseArgs();
  const dataDir = process.env.CONGRESS_DATA_DIR;

  if (!dataDir) {
    console.error("CONGRESS_DATA_DIR is not set. See config.example.env");
    process.exit(1);
  }

  const resolvedData = await resolveDataRoot(dataDir);
  const diag = await diagnoseDataLayout(resolvedData, opts.congress);

  console.log("CivicMirror congress ingest");
  console.log("  data root:", resolvedData);
  console.log("  congress:", opts.congress);
  console.log("  dry-run:", opts.dryRun);
  console.log("  vote files found:", diag.voteFiles);
  console.log("  bill files found:", diag.billFiles);
  if (diag.sessionYears.length) {
    console.log("  vote sessions (years):", diag.sessionYears.join(", "));
  }

  if (opts.diagnose) {
    console.log("\nDiagnosis:", diag);
    process.exit(0);
  }

  if (diag.voteFiles === 0 && diag.billFiles === 0) {
    const repoGuess = path.resolve(dataDir, "..");
    printScrapeInstructions(repoGuess);
    process.exit(1);
  }

  const supabase = opts.dryRun ? null : createAdminClient();
  let runId: string | null = null;

  if (supabase) {
    runId = await startIngestRun(supabase, opts.congress);
  }

  let bills = { processed: 0, upserted: 0, errors: 0 };
  let votes = { processed: 0, upserted: 0, errors: 0 };

  try {
    if (!opts.votesOnly) {
      console.log("\n→ Ingesting bills…");
      bills = await ingestBills(supabase, resolvedData, opts.congress, opts.dryRun, opts.limit);
      console.log("  bills:", bills);
    }

    if (!opts.billsOnly) {
      console.log("\n→ Ingesting votes…");
      votes = await ingestVotes(
        supabase,
        resolvedData,
        opts.congress,
        opts.dryRun,
        opts.sessions,
        opts.limit,
      );
      console.log("  votes:", votes);
    }

    if (runId && supabase) {
      await finishIngestRun(supabase, runId, {
        status: "completed",
        bills_processed: bills.processed,
        bills_upserted: bills.upserted,
        votes_processed: votes.processed,
        votes_upserted: votes.upserted,
        errors_count: bills.errors + votes.errors,
      });
    }

    console.log("\nDone.");
  } catch (e) {
    if (runId && supabase) {
      await finishIngestRun(supabase, runId, {
        status: "failed",
        error_sample: e instanceof Error ? e.message : String(e),
      });
    }
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
