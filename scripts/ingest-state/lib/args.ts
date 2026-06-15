import fs from "node:fs/promises";
import path from "node:path";
import { peopleJsonPath, resolveDataRoot, sessionDir, stateDir } from "./paths.js";

export interface IngestCliOptions {
  state: string;
  year?: number;
  session?: string;
  /** When set with --year, ingest only the regular session id (e.g. 2026 not 2026D). */
  regularSessionOnly: boolean;
  dryRun: boolean;
  votesOnly: boolean;
  billsOnly: boolean;
  limit?: number;
}

export function parseArgs(argv: string[]): IngestCliOptions {
  const opts: IngestCliOptions = {
    state: "",
    regularSessionOnly: false,
    dryRun: false,
    votesOnly: false,
    billsOnly: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--votes-only") opts.votesOnly = true;
    else if (arg === "--bills-only") opts.billsOnly = true;
    else if (arg === "--regular-session-only") opts.regularSessionOnly = true;
    else if (arg === "--include-special-sessions") {
      // Alias kept for parity with download-openstates; ingest includes on-disk
      // special sessions by default when using --year.
    }
    else if (arg.startsWith("--state=")) opts.state = arg.split("=")[1].toUpperCase();
    else if (arg === "--state") opts.state = argv[++i].toUpperCase();
    else if (arg.startsWith("--year=")) opts.year = Number(arg.split("=")[1]);
    else if (arg === "--year") opts.year = Number(argv[++i]);
    else if (arg.startsWith("--session=")) opts.session = arg.split("=")[1];
    else if (arg === "--session") opts.session = argv[++i];
    else if (arg.startsWith("--limit=")) opts.limit = Number(arg.split("=")[1]);
    else if (arg === "--limit") opts.limit = Number(argv[++i]);
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!opts.state) {
    throw new Error("Specify --state FL");
  }

  return opts;
}

export function printHelp(): void {
  console.log(`PolitiGlass — ingest Open States CSV archives into Supabase

Usage:
  npm run ingest -- --state FL --year 2026
  npm run ingest:dry -- --state FL --session 2026
  npm run ingest -- --state FL --year 2026 --votes-only --limit 50

Options:
  --state <ABBR>              State postal code (required)
  --year <YYYY>               Ingest all downloaded sessions for that year
                              (e.g. 2026, 2026D, 2026E when present on disk)
  --session <id>              Single session only (e.g. 2026, 2026D)
  --regular-session-only      With --year, ingest only the regular session (2026)
  --dry-run                   Parse and log without writing
  --votes-only / --bills-only Limit which entities are upserted
  --limit <n>                 Cap votes processed per session (debug)

Requires migration 009_state_legislation.sql and download-openstates data.
`);
}

export interface SessionBundle {
  stateAbbr: string;
  sessionId: string;
  zipPath: string;
  peopleJsonPath: string;
}

export interface SessionDiscovery {
  bundles: SessionBundle[];
  /** Session folders on disk that matched --year but were excluded by filters. */
  skipped: string[];
}

function sessionMatchesFilters(
  sessionId: string,
  opts: IngestCliOptions,
): boolean {
  if (opts.session) return sessionId === opts.session;
  if (opts.year === undefined) return true;
  const yearStr = String(opts.year);
  if (!sessionId.startsWith(yearStr)) return false;
  if (opts.regularSessionOnly) return sessionId === yearStr;
  return true;
}

function isSessionFolderName(name: string): boolean {
  return /^[0-9]{4}[A-Z]?$/.test(name);
}

export async function discoverSessionBundles(
  opts: IngestCliOptions,
): Promise<SessionDiscovery> {
  const dataRoot = resolveDataRoot();
  const statePath = stateDir(dataRoot, opts.state);
  const peoplePath = peopleJsonPath(dataRoot, opts.state);

  let entries: string[];
  try {
    entries = await fs.readdir(statePath);
  } catch {
    throw new Error(
      `No data for ${opts.state} at ${statePath}. Run scripts/download-openstates first.`,
    );
  }

  const bundles: SessionBundle[] = [];
  const skipped: string[] = [];

  for (const sessionId of entries) {
    if (!isSessionFolderName(sessionId)) continue;

    const dir = sessionDir(dataRoot, opts.state, sessionId);
    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }

    const zip = files.find((f) => f.endsWith(".zip"));
    if (!zip) continue;

    if (!sessionMatchesFilters(sessionId, opts)) {
      if (opts.year !== undefined && sessionId.startsWith(String(opts.year))) {
        skipped.push(sessionId);
      }
      continue;
    }

    bundles.push({
      stateAbbr: opts.state,
      sessionId,
      zipPath: path.join(dir, zip),
      peopleJsonPath: peoplePath,
    });
  }

  bundles.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
  skipped.sort();
  return { bundles, skipped };
}
