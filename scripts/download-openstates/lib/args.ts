export interface DownloadCliOptions {
  states: string[];
  allStates: boolean;
  year?: number;
  session?: string;
  includeSpecialSessions: boolean;
  dryRun: boolean;
  force: boolean;
}

export function parseArgs(argv: string[]): DownloadCliOptions {
  const opts: DownloadCliOptions = {
    states: [],
    allStates: false,
    includeSpecialSessions: false,
    dryRun: false,
    force: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--force") opts.force = true;
    else if (arg === "--all-states") opts.allStates = true;
    else if (arg === "--include-special-sessions") opts.includeSpecialSessions = true;
    else if (arg.startsWith("--state=")) opts.states.push(arg.split("=")[1].toUpperCase());
    else if (arg === "--state") opts.states.push(argv[++i].toUpperCase());
    else if (arg.startsWith("--year=")) opts.year = Number(arg.split("=")[1]);
    else if (arg === "--year") opts.year = Number(argv[++i]);
    else if (arg.startsWith("--session=")) opts.session = arg.split("=")[1];
    else if (arg === "--session") opts.session = argv[++i];
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!opts.allStates && opts.states.length === 0) {
    throw new Error("Specify --state FL (or --all-states).");
  }

  if (opts.session && opts.year) {
    throw new Error("Use --session or --year, not both.");
  }

  return opts;
}

export function printHelp(): void {
  console.log(`PolitiGlass — download Open States bulk CSV archives

Usage:
  npm run download -- --state FL --year 2026
  npm run download -- --state FL --year 2026 --include-special-sessions
  npm run download -- --state FL --session 2026
  npm run download:dry -- --state FL --year 2026
  npm run download -- --all-states --year 2026

Options:
  --state <ABBR>              State postal code (repeatable)
  --all-states                Download for every state jurisdiction
  --year <YYYY>               Filter sessions (default: regular session only)
  --session <id>              Download one session identifier (e.g. 2026, 2026D)
  --include-special-sessions  With --year, include 2026D-style special sessions
  --dry-run                   List sessions and URLs without downloading
  --force                     Re-download even if archive exists

Requires OPENSTATES_PLURAL_API_KEY (or OPENSTATES_API_KEY) in .env or repo .env.local.
`);
}
