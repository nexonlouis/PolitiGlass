#!/usr/bin/env npx tsx
/**
 * CivicMirror — ingest Open States CSV zips into Supabase state_* tables.
 */

import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverSessionBundles,
  parseArgs,
  printHelp,
  type SessionBundle,
} from "./lib/args.js";
import {
  buildBillChamberMap,
  buildPartyMap,
  buildSummaryMap,
  normalizeBillRow,
  normalizeLegislatorRow,
  normalizePositionRow,
  normalizeVoteRow,
  buildOrganizationChamberMap,
  type PeopleJsonFile,
} from "./lib/normalize.js";
import { createAdminClient } from "./lib/supabase-admin.js";
import { readCsvFromZip } from "./lib/zip-csv.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(): void {
  dotenv.config({ path: path.resolve(SCRIPT_DIR, ".env") });
  dotenv.config({ path: path.resolve(SCRIPT_DIR, "../../.env.local") });
}

const POSITION_BATCH = 500;

async function startIngestRun(
  supabase: ReturnType<typeof createAdminClient>,
  bundle: SessionBundle,
) {
  const { data, error } = await supabase
    .from("ingest_runs")
    .insert({
      source: "openstates/csv",
      mode: "openstates_session",
      status: "running",
      state_abbr: bundle.stateAbbr,
      session_identifier: bundle.sessionId,
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
  const { error } = await supabase
    .from("ingest_runs")
    .update({ finished_at: new Date().toISOString(), ...patch })
    .eq("id", runId);

  if (error) throw new Error(`ingest_runs update: ${error.message}`);
}

async function ingestLegislators(
  supabase: ReturnType<typeof createAdminClient> | null,
  bundle: SessionBundle,
  dryRun: boolean,
) {
  const raw = await fs.readFile(bundle.peopleJsonPath, "utf8");
  const parsed = JSON.parse(raw) as PeopleJsonFile;
  const rows = parsed.people
    .map((p) => normalizeLegislatorRow(p, bundle.stateAbbr))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (dryRun) {
    console.log(`  legislators: ${rows.length} (dry-run)`);
    return { processed: rows.length, upserted: rows.length, errors: 0, rows };
  }

  const { error } = await supabase!.from("state_legislators").upsert(rows, {
    onConflict: "person_id",
  });
  if (error) throw error;

  console.log(`  legislators: ${rows.length} upserted`);
  return { processed: rows.length, upserted: rows.length, errors: 0, rows };
}

async function ingestSession(
  supabase: ReturnType<typeof createAdminClient> | null,
  bundle: SessionBundle,
  opts: { dryRun: boolean; votesOnly: boolean; billsOnly: boolean; limit?: number },
  legislators: Array<{ person_id: string; party: string | null }>,
) {
  const fileStem = `${bundle.stateAbbr}_${bundle.sessionId}`;
  console.log(`\n→ Session ${bundle.sessionId} (${path.basename(bundle.zipPath)})`);

  const [billRows, abstractRows, voteRows, positionRows, orgRows] = await Promise.all([
    readCsvFromZip(bundle.zipPath, `${fileStem}_bills.csv`),
    readCsvFromZip(bundle.zipPath, `${fileStem}_bill_abstracts.csv`),
    readCsvFromZip(bundle.zipPath, `${fileStem}_votes.csv`),
    readCsvFromZip(bundle.zipPath, `${fileStem}_vote_people.csv`),
    readCsvFromZip(bundle.zipPath, `${fileStem}_organizations.csv`),
  ]);

  const summaryByBillId = buildSummaryMap(abstractRows);
  const orgChamber = buildOrganizationChamberMap(orgRows);
  const partyByPersonId = buildPartyMap(legislators);

  const bills = billRows
    .map((row) => normalizeBillRow(row, summaryByBillId, bundle.stateAbbr))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const billChamberById = buildBillChamberMap(bills);

  let votes = voteRows
    .map((row) => normalizeVoteRow(row, bundle.stateAbbr, billChamberById, orgChamber))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (opts.limit) votes = votes.slice(0, opts.limit);

  const voteIds = new Set(votes.map((v) => v.vote_id));
  const positions = positionRows
    .map((row) => normalizePositionRow(row, partyByPersonId))
    .filter((r): r is NonNullable<typeof r> => r !== null && voteIds.has(r.vote_id));

  const scoringVotes = votes.filter((v) => v.scoring_relevant).length;

  console.log(
    `  parsed: ${bills.length} bills, ${votes.length} votes (${scoringVotes} scoring-relevant), ${positions.length} positions`,
  );

  if (opts.dryRun) {
    if (bills[0]) console.log("  sample bill:", bills[0].identifier, bills[0].title?.slice(0, 60));
    if (votes[0]) {
      console.log(
        "  sample vote:",
        votes[0].motion_text,
        votes[0].motion_classification,
        "scoring:",
        votes[0].scoring_relevant,
      );
    }
    return {
      bills_processed: bills.length,
      bills_upserted: bills.length,
      votes_processed: votes.length,
      votes_upserted: votes.length,
      errors_count: 0,
    };
  }

  let errors = 0;

  if (!opts.votesOnly) {
    for (let i = 0; i < bills.length; i += 200) {
      const chunk = bills.slice(i, i + 200);
      const { error } = await supabase!.from("state_bills").upsert(chunk, {
        onConflict: "bill_id",
      });
      if (error) {
        errors++;
        console.error("  bill upsert error:", error.message);
      }
    }
    console.log(`  bills upserted: ${bills.length}`);
  }

  if (!opts.billsOnly) {
    for (let i = 0; i < votes.length; i += 100) {
      const chunk = votes.slice(i, i + 100);
      const { error } = await supabase!.from("state_roll_call_votes").upsert(chunk, {
        onConflict: "vote_id",
      });
      if (error) {
        errors++;
        console.error("  vote upsert error:", error.message);
      }
    }
    console.log(`  votes upserted: ${votes.length}`);

    for (const vote of votes) {
      await supabase!.from("state_roll_call_positions").delete().eq("vote_id", vote.vote_id);
    }

    for (let i = 0; i < positions.length; i += POSITION_BATCH) {
      const chunk = positions.slice(i, i + POSITION_BATCH);
      const { error } = await supabase!.from("state_roll_call_positions").insert(chunk);
      if (error) {
        errors++;
        if (errors <= 3) console.error("  position insert error:", error.message);
      }
      if ((i + POSITION_BATCH) % 5000 === 0 && i > 0) {
        console.log(`  … positions ${i + POSITION_BATCH}/${positions.length}`);
      }
    }
    console.log(`  positions inserted: ${positions.length}`);
  }

  return {
    bills_processed: bills.length,
    bills_upserted: bills.length,
    votes_processed: votes.length,
    votes_upserted: votes.length,
    errors_count: errors,
  };
}

async function main(): Promise<void> {
  loadEnv();

  let opts: ReturnType<typeof parseArgs>;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    printHelp();
    process.exit(1);
  }

  const { bundles, skipped } = await discoverSessionBundles(opts);
  if (bundles.length === 0) {
    console.error("No session archives found for filters. Run download-openstates first.");
    if (skipped.length > 0) {
      console.error(
        `  On disk but skipped: ${skipped.join(", ")} (remove --regular-session-only or use --session)`,
      );
    }
    process.exit(1);
  }

  console.log("CivicMirror state ingest");
  console.log("  state:", opts.state);
  console.log("  sessions:", bundles.map((b) => b.sessionId).join(", "));
  if (skipped.length > 0) {
    console.log(`  skipped: ${skipped.join(", ")} (--regular-session-only)`);
  }
  console.log("  dry-run:", opts.dryRun);

  const supabase = opts.dryRun ? null : createAdminClient();

  const legislatorResult = await ingestLegislators(
    supabase,
    bundles[0],
    opts.dryRun,
  );

  let totals = {
    bills_processed: 0,
    bills_upserted: 0,
    votes_processed: 0,
    votes_upserted: 0,
    errors_count: 0,
  };

  for (const bundle of bundles) {
    let runId: string | null = null;
    if (supabase) {
      runId = await startIngestRun(supabase, bundle);
    }

    try {
      const result = await ingestSession(
        supabase,
        bundle,
        opts,
        legislatorResult.rows,
      );
      totals = {
        bills_processed: totals.bills_processed + result.bills_processed,
        bills_upserted: totals.bills_upserted + result.bills_upserted,
        votes_processed: totals.votes_processed + result.votes_processed,
        votes_upserted: totals.votes_upserted + result.votes_upserted,
        errors_count: totals.errors_count + result.errors_count,
      };

      if (runId && supabase) {
        await finishIngestRun(supabase, runId, {
          status: "completed",
          ...result,
        });
      }
    } catch (err) {
      if (runId && supabase) {
        await finishIngestRun(supabase, runId, {
          status: "failed",
          error_sample: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    }
  }

  console.log("\nTotals:", totals);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
