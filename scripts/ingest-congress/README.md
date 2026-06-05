# Congress data ingest (unitedstates/congress → Supabase)

Batch pipeline for CivicMirror voting records. See [design doc](../../docs/design/congress-vote-ingestion.md).

## Prerequisites

1. **Supabase migrations** — Run `003_legislation_votes.sql` and `004_ingest_service_role_policies.sql` in the SQL editor.
2. **Python 3** — For the unitedstates scraper (separate from Next.js).
3. **Node 20+** — For the ingest script.

## Step 1: Collect data (Python) — required before ingest

Ingest reads JSON from disk. If you see `processed: 0`, you have not scraped yet.

Clone and install [unitedstates/congress](https://github.com/unitedstates/congress) **outside** this repo (or as a sibling directory):

```bash
git clone https://github.com/unitedstates/congress.git
cd congress
python3 -m venv env && source env/bin/activate
pip install .
```

Run scrapers (from the `congress` repo root):

```bash
# Full backfill for current Congress
./run votes --congress=119
./run bills --congress=119

# Daily incremental (last ~3 days of vote changes)
./run votes --fast
```

Output lands in `congress/data/`. Verify:

```bash
ls congress/data/119/votes
npm run diagnose -- --congress=119
```

Set `CONGRESS_DATA_DIR` to that `data` folder (or the congress repo root).

Alternatively use `scripts/ingest-congress/run-scraper.sh` if `CONGRESS_REPO_DIR` is set.

## Troubleshooting RLS errors

If you see `violates row-level security policy for table "ingest_runs"`:

1. Run migration `004_ingest_service_role_policies.sql`.
2. Confirm `.env` uses **service_role secret** (`sb_secret_…`), not `sb_publishable_…` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Step 2: Configure ingest

```bash
cd scripts/ingest-congress
cp config.example.env .env
# Edit .env — set SUPABASE_* and CONGRESS_DATA_DIR
npm install
```

## Step 3: Run ingest

```bash
# Dry run (parse only, no writes)
npm run ingest -- --dry-run --congress=119

# Upsert votes + bills
npm run ingest -- --congress=119

# Votes only, specific sessions
npm run ingest -- --congress=119 --votes-only --sessions=2026
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **service_role secret** (`sb_secret_…`) from Dashboard → API — **not** the publishable/anon key |
| `CONGRESS_DATA_DIR` | Yes | Path to unitedstates `data/` root |
| `INGEST_CONGRESS` | No | Default congress number (`119`) |

## Scheduling example (cron)

```cron
0 6 * * * cd /path/to/congress && ./run votes --fast
30 6 * * * cd /path/to/CivicMirror/scripts/ingest-congress && npm run ingest -- --congress=119
```

## After ingest

1. Verify: `select count(*) from roll_call_votes;`
2. Implement Phase 2: point `/api/voting-records` at `member_votes_enriched` view.
3. Run issue-tag batch job: `cd ../tag-bills && npm run tag` (see `scripts/tag-bills/README.md`).
