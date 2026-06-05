# Congress vote & bill ingestion (unitedstates/congress)

## Goal

Serve **fast, reliable** voting-record and reflection-score data in CivicMirror by **batch-loading** official roll-call votes and related bills into Supabase. The UI and API routes should read **only from Postgres** on user requests—not scrape Congress at page-load time.

## Source: [unitedstates/congress](https://github.com/unitedstates/congress)

| Aspect | Detail |
|--------|--------|
| What it is | Python tooling (`usc-run`) that downloads **official** House/Senate roll-call XML and GPO bill status, writes structured JSON |
| What it is not | Data files in the GitHub repo itself—you run the scraper and get a local `data/` tree |
| License | CC0 / public domain |
| Coverage | House & Senate roll calls (~1990–present); bills, amendments, vote metadata |
| Output path | `data/{congress}/votes/{session}/{h\|s}{number}/data.json` |
| Bills path | `data/{congress}/bills/{type}/{type}{number}/data.json` |

Reference wiki: [Votes](https://github.com/unitedstates/congress/wiki/Votes), [Bills](https://github.com/unitedstates/congress/wiki/bills).

### Example vote `data.json` (shape)

```json
{
  "vote_id": "h240-119.2025",
  "chamber": "h",
  "congress": 119,
  "session": "2025",
  "number": 240,
  "date": "2025-09-08T18:56:00-04:00",
  "category": "passage",
  "question": "On Passage",
  "type": "On Passage",
  "result": "Passed",
  "bill": { "type": "hr", "number": 3424, "congress": 119 },
  "votes": {
    "Yea": [{ "id": "T000488", "display_name": "Thanedar", "party": "D", "state": "MI" }],
    "Nay": []
  }
}
```

Member `id` is the **Bioguide ID**—same identifier CivicMirror already stores on `saved_representatives.bioguide_id`.

## Why batch → database (not live API)

| Live Congress.gov (current MVP) | Batch unitedstates → Supabase |
|--------------------------------|-------------------------------|
| House-only roll calls in API | House **and** Senate |
| N+1 HTTP per vote list | Single indexed query per user |
| Rate limits & latency | Sub-100ms reads after ingest |
| Weak bill ↔ vote linkage | `category`, `bill`, `question` preserved |
| Hardcoded `issueSlug` | Join to `bills` + `issue_slugs` |

Congress.gov API remains useful for **incremental delta** or validation; it is not the primary read path after ingest is live.

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│ unitedstates/congress│     │ scripts/ingest-congress │     │ Supabase Postgres│
│ usc-run votes/bills  │────▶│ normalize + upsert      │────▶│ bills            │
│ (cron / GH Action)   │     │ (Node + service role)   │     │ roll_call_votes  │
└─────────────────────┘     └──────────────────────┘     │ roll_call_positions│
                                                          │ ingest_runs        │
                                                          └─────────┬──────────┘
                                                                    │
                                                          ┌─────────▼──────────┐
                                                          │ Next.js API (read) │
                                                          │ reflection-score   │
                                                          └────────────────────┘
```

### Pipelines

1. **Scrape** (Python, scheduled): `usc-run votes --congress=119` and optionally `usc-run bills --congress=119`. Use `--fast` for daily incremental (last ~3 days).
2. **Ingest** (Node/TS, scheduled after scrape): Walk `data/`, upsert into Supabase with service role.
3. **Tag** (future batch): Populate `bills.issue_slugs` from subjects + LLM; no user-facing latency.
4. **Serve**: `/api/voting-records` and `/api/reflection-score` query DB only.

## ID conventions

| Entity | Canonical ID | Example |
|--------|--------------|---------|
| Bill | `{type}{number}-{congress}` | `hr3424-119` |
| Vote | `vote_id` from source | `h240-119.2025` |
| Member | Bioguide | `T000488` |

Helper: `formatBillId({ type: 'hr', number: 3424, congress: 119 }) → 'hr3424-119'`.

## Database tables (migration `003_legislation_votes.sql`)

| Table | Role |
|-------|------|
| `bills` | Canonical bill metadata + `issue_slugs` for reflection scoring |
| `roll_call_votes` | One row per roll-call vote |
| `roll_call_positions` | One row per (vote, member) |
| `ingest_runs` | Audit log for batch jobs |
| `bill_issue_tags` | **Legacy**—retained; prefer `bills.issue_slugs` for new code |

### Scoring query (target)

For a user's House/Senate rep (`bioguide_id`) and issue tags (`text[]`):

1. Select recent `roll_call_positions` for that member.
2. Join `roll_call_votes` (date, category, question).
3. Join `bills` on `related_bill_id` where `issue_slugs && user_tags`.
4. Weight by `category` (e.g. `passage` = 1.0, `amendment` = 0.7, `procedural` = 0.3).
5. Pass rows to existing `computeReflectionScore()` in app code, or SQL aggregate later.

## Row Level Security

| Table | SELECT | INSERT/UPDATE/DELETE |
|-------|--------|----------------------|
| `bills`, `roll_call_votes`, `roll_call_positions` | `authenticated` | **service role only** (ingest script) |
| `ingest_runs` | none for clients | service role only |

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Ingest job behavior

### Idempotency

- Upsert on `vote_id`, `(vote_id, bioguide_id)`, `bill_id`.
- Skip vote file if `source_updated_at` ≤ stored `source_updated_at` (from JSON `updated_at`).

### Order of operations

1. Start `ingest_runs` row (`status = running`).
2. Ingest bills for target congress (if `data/{congress}/bills` present).
3. Ingest votes: walk `data/{congress}/votes/**/data.json`.
4. Delete stale positions for updated votes (or replace all positions per vote in a transaction).
5. Mark `ingest_runs` complete with counts.

### Error handling

- Per-file try/catch; log path + continue.
- Fail run if >5% of files error or zero votes ingested on full backfill.
- Do not partial-commit a single vote: one transaction per `vote_id` (vote + positions).

### Environment

| Variable | Used by |
|----------|---------|
| `SUPABASE_URL` | ingest script |
| `SUPABASE_SERVICE_ROLE_KEY` | ingest script |
| `CONGRESS_DATA_DIR` | path to unitedstates `data/` root |
| `INGEST_CONGRESS` | default `119` |
| `INGEST_SESSIONS` | optional comma list, e.g. `2025,2026` |

## Scheduling (recommended)

| Job | Cadence | Command |
|-----|---------|---------|
| Scrape (fast) | Daily 6am ET | `usc-run votes --fast` |
| Scrape (bills) | Weekly | `usc-run bills --congress=119` |
| Ingest | Daily after scrape | `npm run ingest:congress` |

Run scraper on a VM, GitHub Actions artifact, or dedicated worker—not Vercel serverless (Python + long I/O).

## Implementation phases

| Phase | Deliverable | User-visible |
|-------|-------------|--------------|
| **0** (this PR) | Design doc, migration, script outline | — |
| **1** | Backfill congress 119 votes + bills; verify counts | — |
| **2** | Switch `/api/voting-records` to DB | Live vote list |
| **3** | Switch `/api/reflection-score` to DB + real issue slugs | Accurate score |
| **4** | Issue-tag batch job (LLM or subject map) | Better relevance |
| **5** | Optional Congress.gov delta for same-day votes | Fresher data |

## Alternatives considered

| Option | Verdict |
|--------|---------|
| Live unitedstates in API | Rejected—no hosted API; wrong tool |
| Hear-Ye/congress-data mirror | Optional shortcut; add fallback if self-host is heavy |
| CIV.IQ only | Good fallback; less control over schema/history |
| Congress.gov only | Keep as supplement; Senate gap remains |

## Files in this repo

```
docs/design/congress-vote-ingestion.md     ← this document
supabase/migrations/003_legislation_votes.sql
scripts/ingest-congress/
  README.md
  config.example.env
  run-scraper.sh
  package.json              ← local deps for ingest CLI
  ingest.ts                 ← main upsert script (outline)
  lib/normalize.ts
  lib/supabase-admin.ts
  types/usc-vote.ts
  types/usc-bill.ts
```

## Open questions (resolve in Phase 1)

1. **Hosting scraper** — GitHub Action vs small VPS vs local cron during dev.
2. **Historical depth** — Start with 119th only, or include 118th for richer reflection score.
3. **At-large districts** — House `district` 0 in some APIs; map to `00` if needed.
4. **Vice presidential Senate tie-breakers** — Include in positions with `bioguide_id` for VP when present.
