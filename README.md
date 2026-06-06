# CivicMirror

Nonpartisan civic engagement app: find your elected officials, personalize issue priorities, and see how their roll-call votes align with the issues you care about.

## How it works

```
Address lookup (live APIs)          Batch legislation pipeline (offline)
─────────────────────────          ─────────────────────────────────────
Geocodio / Census / Congress.gov   unitedstates/congress (Python scrape)
        │                                    │
        ▼                                    ▼
   Your representatives              JSON on disk → Supabase Postgres
        │                           (bills, roll_call_votes, positions)
        │                                    │
        └──────────────┬─────────────────────┘
                       ▼
              Next.js API + Dashboard
         reflection score · voting records · forum
```

**Representative lookup** uses live upstream APIs at request time.

**Voting records and reflection scores** read from **Supabase only** — populated by batch ingest from [unitedstates/congress](https://github.com/unitedstates/congress), not from Congress.gov at page load.

Congress.gov (with a Census geocoder fallback) is still used to resolve **who** represents an address when Geocodio is unavailable.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS
- **Supabase** — Auth, PostgreSQL, RLS, Realtime (district forum)
- **Live lookup** — Geocodio, US Census Geocoder, Congress.gov, CIV.IQ (fallback), demo mode
- **Legislation data** — [unitedstates/congress](https://github.com/unitedstates/congress) → `scripts/ingest-congress` → Supabase
- **Bill tagging** — `scripts/tag-bills` (subject map + optional [Ollama](https://ollama.com) local LLM)

## Quick start (app)

### 1. Install dependencies

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Minimum for the app:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + anon API reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Server routes (optional if migration `005` applied) |

For **live official lookup** (recommended):

| Variable | Purpose |
|----------|---------|
| `GEOCODIO_API_KEY` | Primary address → legislators |
| `CONGRESS_GOV_API_KEY` | Fallback member lookup (not used for votes) |
| `CIVIC_MIRROR_DEMO_MODE=false` | Avoid mock officials when APIs fail |

### 3. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run all migrations in the SQL editor, in order:

   | File | Purpose |
   |------|---------|
   | `001_initial_schema.sql` | Profiles, demographics, forum |
   | `002_forum_realtime.sql` | Realtime for district posts |
   | `003_legislation_votes.sql` | Bills, roll calls, positions |
   | `004_ingest_service_role_policies.sql` | Ingest script write access |
   | `005_legislation_public_read.sql` | Anon read for legislation tables |
   | `006_vote_scoring_relevant.sql` | Filter procedural votes from scoring |

3. Enable Email auth under Authentication → Providers.

### 4. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Legislation pipeline (votes data)

Voting data does **not** come from Congress.gov at runtime. Set up the batch pipeline once (then refresh on a schedule).

### Step 1 — Scrape (Python, outside this repo)

Clone [unitedstates/congress](https://github.com/unitedstates/congress):

```bash
git clone https://github.com/unitedstates/congress.git
cd congress
python3 -m venv env && source env/bin/activate
pip install .

# Backfill current Congress
./run votes --congress=119
./run bills --congress=119

# Daily incremental
./run votes --fast
```

JSON output lives in `congress/data/`. See [scripts/ingest-congress/README.md](scripts/ingest-congress/README.md) for details.

### Step 2 — Ingest into Supabase

```bash
cd scripts/ingest-congress
cp config.example.env .env
# Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service_role secret), CONGRESS_DATA_DIR
npm install
npm run ingest -- --dry-run --congress=119
npm run ingest -- --congress=119
```

Verify: `select count(*) from roll_call_votes;`

### Step 3 — Tag bills for reflection scoring

Bills need `issue_slugs` so votes map to user priority issues.

```bash
cd scripts/tag-bills
cp config.example.env .env   # reuse Supabase creds from ingest
npm install

npm run tag:dry              # subject map preview
npm run tag                  # write tags (fast)

# Optional: local LLM for bills the subject map misses
ollama pull gemma4
npm run tag:ollama:dry
npm run tag:ollama
```

See [scripts/tag-bills/README.md](scripts/tag-bills/README.md) for dry-run explain output and Ollama options.

**Design doc:** [docs/design/congress-vote-ingestion.md](docs/design/congress-vote-ingestion.md)

## Routes

| Path | Description |
|------|-------------|
| `/` | Landing |
| `/onboarding` | 4-step calibration (address, demographics, issue tags) |
| `/auth` | Sign up / sign in |
| `/dashboard` | Officials, reflection score, forum preview |
| `/forum` | District discussion board (posts, votes, comments, Realtime) |

## API routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/lookup-representatives` | POST | No | Address → district + federal officials (live APIs) |
| `/api/suggest-tags` | POST | No | Demographics → suggested issue tag slugs |
| `/api/voting-records` | GET | No | Member roll-call votes from Supabase |
| `/api/reflection-score` | GET | No | Alignment score vs user's issue tags |
| `/api/health/data-sources` | GET | No | Which data sources are configured |
| `/api/onboarding/complete` | POST | Yes | Save profile, demographics, saved reps |

### Voting & scoring query params

**`/api/voting-records`**

| Param | Description |
|-------|-------------|
| `bioguideId` | Required. Member Bioguide ID (e.g. `T000488`) |
| `limit` | Max votes (default 25, max 100) |
| `tags` | Comma-separated user issue slugs (for issue mapping) |
| `includeProcedural` | `1` or `true` to include process votes (default: policy-relevant only) |

**`/api/reflection-score`**

| Param | Description |
|-------|-------------|
| `bioguideId` | Required |
| `tags` | Comma-separated issue slugs (default `healthcare`) |
| `weight_{slug}` | Per-tag weight 1–5 (e.g. `weight_healthcare=4`) |

Both return `"source": "database"`.

## Data sources

| Source | Used for | Runtime |
|--------|----------|---------|
| **Supabase** (`roll_call_*`, `bills`) | Voting records, reflection score | Read at request time |
| **Geocodio** | Address → legislators | Live |
| **US Census Geocoder** | Address → congressional district | Live (free) |
| **Congress.gov API** | Current member lookup fallback | Live |
| **CIV.IQ** | Address / officials fallback | Live |
| **unitedstates/congress** | Official House + Senate roll-call JSON | Batch scrape → ingest |
| **Demo mode** | Mock officials when all lookups fail | Live fallback |

Congress.gov is **not** the primary path for roll-call votes. Senate and House votes both come from ingested unitedstates data once the pipeline has run.

Procedural votes (previous question, rules resolutions, etc.) are stored but **excluded from reflection scoring** by default (`scoring_relevant` column, migration `006`).

## Issue tags

Users pick **3–8** tags during onboarding from **18** curated slugs (healthcare, foreign-policy, national-security, etc.). Tags are defined in `src/lib/constants/issue-tags.ts` and applied to bills via the tagging scripts.

## Privacy model

- `profiles` — username, avatar, **district only** (community-visible)
- `user_demographics` — income bracket, education, issue tags (RLS: owner-only)
- `saved_representatives` — user's saved officials (owner-only)

## Project layout

```
docs/design/           Design notes (congress ingestion)
scripts/ingest-congress/   unitedstates JSON → Supabase upsert
scripts/tag-bills/         Bill issue_slugs (subject map + Ollama)
src/app/api/           Next.js API routes
src/lib/legislation/   Reflection score, DB vote queries, procedural filter
supabase/migrations/   SQL schema (001–006)
```

## Roadmap

- [x] District forum UI + Supabase Realtime
- [x] unitedstates/congress ingest pipeline
- [x] DB-backed `/api/voting-records` and `/api/reflection-score`
- [x] Bill tagging scripts (subject map + Ollama)
- [x] Expanded issue slugs + procedural vote filtering
- [ ] Scheduled scrape + ingest (cron / GitHub Actions)
- [ ] YouTube curated feed per representative

## License

Private / unlicensed — add your license as needed.
