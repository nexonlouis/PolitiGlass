# Open States CSV → Supabase (state legislation)

Batch ingest for state bills, roll-call votes, and legislator positions. See [design doc](../../docs/design/state-legislation.md).

## Prerequisites

1. **Migration `009_state_legislation.sql`** in Supabase SQL editor.
2. **Downloaded data** from `scripts/download-openstates` (e.g. FL 2026).
3. **Service role key** in `.env` (same as congress ingest).

## Configure

```bash
cd scripts/ingest-state
cp config.example.env .env
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
```

## Usage

```bash
# Florida 2026 — all downloaded sessions (2026, 2026D, 2026E, …)
npm run ingest:dry -- --state FL --year 2026
npm run ingest -- --state FL --year 2026

# Regular session only (skip special sessions on disk)
npm run ingest -- --state FL --year 2026 --regular-session-only

# Single session
npm run ingest -- --state FL --session 2026D
```

**Note:** Unlike `download-openstates`, ingest with `--year 2026` includes **every session folder on disk** whose id starts with `2026` (regular + specials). Use `--regular-session-only` to match download’s default of regular session only.

## What gets written

| Table | Source |
|-------|--------|
| `state_legislators` | `people/current.json` |
| `state_bills` | `*_bills.csv` + `*_bill_abstracts.csv` |
| `state_roll_call_votes` | `*_votes.csv` |
| `state_roll_call_positions` | `*_vote_people.csv` |

Before positions are inserted, **stub legislator rows** are created for any `voter_id` in `vote_people` that is missing from `people/current.json` (former members, etc.). Stubs use the voter name from the CSV and `ignoreDuplicates` so full current-member rows are not overwritten.

Votes with `committee-passage` and similar motions are stored with `scoring_relevant = false` (see `src/lib/legislation/state-vote-scoring.ts`).

## Verify

```sql
select count(*) from state_bills where state = 'FL';
select count(*) from state_roll_call_votes where state = 'FL' and scoring_relevant;
select count(*) from state_roll_call_positions;
```

## Next steps

- `scripts/tag-state-bills` — populate `issue_slugs` for reflection scoring
- API + dashboard — state House/Senate reflection tabs
