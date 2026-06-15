# Tag state bills (`issue_slugs`)

Maps ingested `state_bills` rows to PolitiGlass issue slugs for state reflection scoring.

## Setup

```bash
cd scripts/tag-state-bills
cp config.example.env .env   # or symlink ../ingest-state/.env
npm install
ollama pull gemma4
```

Run after `scripts/ingest-state` has loaded bills and votes into Supabase.

## Usage

```bash
# Preview tags (scoring-relevant vote-linked bills only)
npm run tag:dry -- --state=FL

# Write tags for Florida 2026 regular session
npm run tag -- --state=FL --session=2026

# Include bills linked only to committee/procedural votes
npm run tag:dry -- --state=FL --all-votes

# All untagged bills in a state
npm run tag -- --state=FL --all
```

## Ollama tagging

For bills the subject map misses, use local Ollama (`gemma4` by default). The state prompt requires at least one tag for **substantive** bills (best available slug) and returns empty only for clearly procedural bills (appropriations omnibus, honorary resolutions, claims bills, etc.).

```bash
npm run tag:ollama:dry -- --state=FL
npm run tag:ollama -- --state=FL

# Overnight full pass over vote-linked bills
npx tsx ollama-tag.ts --state=FL --force --delay-ms=250
```

| Flag | Scripts | Purpose |
|------|---------|---------|
| `--dry-run` | both | Preview without writing |
| `--quiet` | both | One-line dry-run summary |
| `--limit=N` | both | Cap bills processed |
| `--state=FL` | both | Filter by state |
| `--session=2026` | both | Filter by session |
| `--all` | both | All untagged bills, not just vote-linked |
| `--force` | both | Re-tag even if `issue_slugs` already set |
| `--all-votes` | both | Include procedural vote-linked bills |
| `--delay-ms=N` | ollama | Pause between model calls (default 250) |
| `--model=name` | ollama | Override `OLLAMA_MODEL` |

## Subject-map flags

| Flag | Purpose |
|------|---------|
| `--dry-run` | Preview without writing |
| `--quiet` | One-line dry-run summary |
| `--limit=N` | Cap bills processed |
| `--state=FL` | Filter by state |
| `--session=2026` | Filter by session identifier |
| `--all` | All untagged bills, not just vote-linked |
| `--force` | Re-tag even if `issue_slugs` already set |
| `--all-votes` | Include bills from procedural votes (default: scoring-relevant only) |

By default, only bills tied to **`scoring_relevant`** roll calls are tagged (floor passage votes). Committee-only bills are skipped unless you pass `--all-votes`.

## Tagging logic

1. **State subject map** — Florida/Open States subject index phrases (e.g. `taxation and finance`, `public health`)
2. **Federal subject map** — reused from `scripts/tag-bills/lib/subject-map.ts` (substring + title keywords)
3. **Roll-call context** — `motion_text` from `state_roll_call_votes` when title/subjects are sparse

## Verify

```sql
select count(*) from state_bills where state = 'FL' and cardinality(issue_slugs) > 0;
select identifier, title, issue_slugs
from state_bills
where state = 'FL' and cardinality(issue_slugs) > 0
limit 10;
```
