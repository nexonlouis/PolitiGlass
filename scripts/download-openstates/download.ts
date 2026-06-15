#!/usr/bin/env npx tsx
/**
 * PolitiGlass — download Open States bulk CSV session archives + people CSV.
 *
 * See README.md and docs/design/state-legislation.md.
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, printHelp } from "./lib/args.js";
import { downloadPeopleJson, downloadSessionArchive } from "./lib/download-session.js";
import {
  filterSessions,
  listStateJurisdictions,
  resolveStateAbbr,
  stateAbbrFromJurisdiction,
} from "./lib/openstates-client.js";
import { resolveDataRoot } from "./lib/paths.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(): void {
  dotenv.config({ path: path.resolve(SCRIPT_DIR, ".env") });
  dotenv.config({ path: path.resolve(SCRIPT_DIR, "../../.env.local") });
}

async function downloadState(
  stateAbbr: string,
  cli: ReturnType<typeof parseArgs>,
  dataRoot: string,
): Promise<void> {
  const { jurisdiction } = await resolveStateAbbr(stateAbbr);
  const sessions = jurisdiction.legislative_sessions ?? [];

  const selected = filterSessions(sessions, {
    year: cli.year,
    session: cli.session,
    includeSpecialSessions: cli.includeSpecialSessions,
  });

  console.log(`\n${stateAbbr} — ${jurisdiction.name}`);
  console.log(`  jurisdiction: ${jurisdiction.id}`);
  console.log(`  sessions matched: ${selected.length}`);

  if (selected.length === 0) {
    console.warn(`  No sessions matched filters (year=${cli.year ?? "any"}, session=${cli.session ?? "—"})`);
    return;
  }

  for (const session of selected) {
    await downloadSessionArchive(dataRoot, stateAbbr, session, {
      dryRun: cli.dryRun,
      force: cli.force,
    });
  }

  await downloadPeopleJson(dataRoot, stateAbbr, {
    dryRun: cli.dryRun,
    force: cli.force,
  });
}

async function main(): Promise<void> {
  loadEnv();

  let cli: ReturnType<typeof parseArgs>;
  try {
    cli = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    printHelp();
    process.exit(1);
  }

  const dataRoot = resolveDataRoot();
  console.log(`Data directory: ${dataRoot}`);
  if (cli.dryRun) console.log("(dry-run — no files written)\n");

  const states: string[] = [];

  if (cli.allStates) {
    const jurisdictions = await listStateJurisdictions();
    for (const j of jurisdictions) {
      const abbr = stateAbbrFromJurisdiction(j);
      if (abbr) states.push(abbr);
    }
    states.sort();
    console.log(`All states: ${states.length} jurisdictions`);
  } else {
    states.push(...cli.states);
  }

  for (const abbr of states) {
    await downloadState(abbr, cli, dataRoot);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
