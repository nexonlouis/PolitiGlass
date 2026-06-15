# PolitiGlass

**https://politiglass.com** — Nonpartisan civic engagement app: find your elected officials, personalize issue priorities, and see how their roll-call votes align with the issues you support or oppose.

## How it works

```
Address lookup (live APIs)          Batch legislation pipeline (offline)
─────────────────────────          ─────────────────────────────────────
Census Geocoder + Congress.gov     unitedstates/congress (Python scrape)
(Geocodio / CIV.IQ fallback)               │
        │                                    ▼
        ▼                          JSON on disk → Supabase Postgres
   Your representatives            (bills, roll_call_votes, positions)
        │                                    │
        └──────────────┬─────────────────────┘
                       ▼
              Next.js API + Dashboard
    reflection score · bill evidence · per-bill overrides · forum
```

**Representative lookup** uses live upstream APIs at request time. The primary path is the **US Census Geocoder** (current **119th** congressional district boundaries) plus the **Congress.gov API** for current House and Senate members. Geocodio and CIV.IQ are fallbacks.

**Voting records and reflection scores** read from **Supabase only** — populated by batch ingest from [unitedstates/congress](https://github.com/unitedstates/congress), not from Congress.gov at page load. Senate roll calls use LIS→Bioguide ID mapping at ingest/query time.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS
- **Supabase** — Auth, PostgreSQL, RLS, Realtime (district forum)
- **Live lookup** — Census Geocoder + Congress.gov (primary), Geocodio, CIV.IQ (fallback), demo mode
- **Legislation data** — [unitedstates/congress](https://github.com/unitedstates/congress) → `scripts/ingest-congress` → Supabase
- **Bill tagging** — `scripts/tag-bills` (subject map + optional [Ollama](https://ollama.com) `gemma4`)
- **Bill metadata** — Congress.gov CRS summaries cached to `bills` when `CONGRESS_GOV_API_KEY` is set

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
| `CONGRESS_GOV_API_KEY` | **Primary** — district members + CRS bill summaries |
| `GEOCODIO_API_KEY` | Optional fallback address → legislators |
| `CONGRESS_NUMBER` | Congress session for member lookup (default `119`) |
| `POLITIGLASS_DEMO_MODE=false` | Avoid mock officials when APIs fail |

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
   | `007_member_votes_bill_summary.sql` | Bill summary on enriched vote view |
   | `008_user_reflection_overrides.sql` | Per-bill alignment overrides (signed-in users) |
| `009_state_legislation.sql` | State bills, votes, legislators (Open States ingest) |
   | `010_state_rep_chamber.sql` | `saved_representatives.state_legislative_chamber` |
   | `011_state_reflection_overrides.sql` | Index for state override lookups |

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

JSON output lives in `congress/data/`. Scraping **bills** (not just votes) populates `bills.summary` for reflection evidence on the dashboard.

See [scripts/ingest-congress/README.md](scripts/ingest-congress/README.md) for details.

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

Bills need `issue_slugs` so votes map to user priority issues. Re-run after changing the tag catalog in `issue-tags.ts`.

```bash
cd scripts/tag-bills
cp config.example.env .env   # reuse Supabase creds from ingest
npm install

npm run tag:dry              # subject map preview (shows match reasoning)
npm run tag                  # write tags (fast)

# Optional: local LLM for bills the subject map misses
ollama pull gemma4
npm run tag:ollama:dry
npm run tag:ollama
```

See [scripts/tag-bills/README.md](scripts/tag-bills/README.md) for dry-run explain output and Ollama options.

**Design doc:** [docs/design/congress-vote-ingestion.md](docs/design/congress-vote-ingestion.md)

## State legislation pipeline (in progress)

State roll-call votes and reflection scoring use **Open States bulk CSV** data. Work is on branch `feature/state-legislation`.

```bash
cd scripts/download-openstates
cp config.example.env .env   # OPENSTATES_PLURAL_API_KEY
npm install
npm run download -- --state FL --year 2026
```

See [docs/design/state-legislation.md](docs/design/state-legislation.md) and [scripts/download-openstates/README.md](scripts/download-openstates/README.md).

**Ingest** (after migration `009`):

```bash
cd scripts/ingest-state
cp config.example.env .env
npm install
npm run ingest -- --state FL --year 2026
```

**Tag** (after ingest):

```bash
cd scripts/tag-state-bills
cp config.example.env .env   # reuse Supabase creds from ingest-state
npm install
npm run tag:dry -- --state=FL
npm run tag -- --state=FL --session=2026
```

See [scripts/tag-state-bills/README.md](scripts/tag-state-bills/README.md).

API lookup and dashboard integration are next.

**Runtime lookup** (onboarding): after federal officials resolve, the app geocodes the address with Census, calls Open States `people.geo`, and saves state House/Senate legislators with `person_id`. Requires `OPENSTATES_PLURAL_API_KEY` in `.env.local`.

**Reflection scores** for state legislators use the same `/api/reflection-score` endpoint (`bioguideId` = `ocd-person/…`) against `state_member_votes_enriched`. Run ingest + tag-state-bills first.

## Reflection score

The dashboard compares your official's roll-call votes to your stated priorities:

1. **Issue tags** — you pick 3–8 from ~28 curated slugs during onboarding (editable on `/profile`).
2. **Stance** — each tag is **support** (want Yea on bills advancing that issue) or **oppose** (want Nay).
3. **Bill matching** — only votes on bills tagged with an issue you selected count toward the score.
4. **Procedural filter** — chamber process votes (previous question, rules resolutions, etc.) are excluded by default.
5. **Bill evidence** — per-official House/Senate tabs; expand "Show N bills used in this score" for title, CRS summary, rep vote, and alignment.
6. **Per-bill overrides** — signed-in users can tap **You support** / **You oppose** on a bill if their view differs from issue-tag defaults. Aligned/Diverged updates from how the rep voted. Overrides are stored in `user_reflection_overrides` and refetched into the score.

Omnibus bills with multiple roll calls on the same `bill_id` are deduplicated to one evidence row per bill.

User preferences are stored in `user_demographics.issue_tag_weights` as JSON per tag:

```json
{ "healthcare": { "weight": 4, "stance": "support" }, "tax-relief": { "weight": 3, "stance": "oppose" } }
```

## Onboarding issue picker

- Tags are **sorted by demographics** (income, education, children, age) with popular tags first.
- Selecting a tag highlights **pro** (aligned) and **anti** (opposing) related tags.
- Pro highlights add with `support` stance; anti highlights add with `oppose` stance.
- Each selected tag can be toggled between Support / Oppose before saving.

Tag definitions and pro/anti graph: `src/lib/constants/issue-tags.ts`. Legacy bill tag slugs are aliased at scoring time via `src/lib/legislation/bill-tag-aliases.ts`.

## Routes

| Path | Description |
|------|-------------|
| `/` | Landing |
| `/onboarding` | Address → demographics → issue tags (with pro/anti hints) → reveal |
| `/auth` | Sign up / sign in |
| `/dashboard` | Officials, reflection score + bill evidence, forum preview |
| `/profile` | Username, demographics, issue tags (signed in) |
| `/forum` | District discussion board (posts, votes, comments, Realtime) |

## API routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/lookup-representatives` | POST | No | Address → district + federal officials (live APIs) |
| `/api/suggest-tags` | POST | No | Demographics → ranked tag suggestions + display order |
| `/api/voting-records` | GET | No | Member roll-call votes from Supabase |
| `/api/reflection-score` | GET | Optional | Stance-aware alignment score + bill evidence; loads overrides when signed in |
| `/api/reflection-overrides` | PUT / DELETE | Yes | Save or clear per-bill alignment override |
| `/api/profile` | GET / PATCH | Yes | Load or update username, demographics, tag preferences |
| `/api/health/data-sources` | GET | No | Which data sources are configured |
| `/api/onboarding/complete` | POST | Yes | Save profile, demographics, tag preferences, saved reps |

### Voting & scoring query params

**`/api/voting-records`**

| Param | Description |
|-------|-------------|
| `bioguideId` | Required. Member Bioguide ID (e.g. `T000488`) |
| `limit` | Max votes (default 25, max 100) |
| `tags` | Comma-separated user issue slugs |
| `stance_{slug}` | `support` or `oppose` per tag |
| `weight_{slug}` | Per-tag weight 1–5 |
| `includeProcedural` | `1` or `true` to include process votes (default: policy-relevant only) |

**`/api/reflection-score`**

| Param | Description |
|-------|-------------|
| `bioguideId` | Required |
| `tags` | Comma-separated issue slugs |
| `stance_{slug}` | `support` or `oppose` (default `support`) |
| `weight_{slug}` | Per-tag weight 1–5 (default 3) |
| `includeVotes` | `1` or `true` to return full `scoredVotes` list with title + summary (default on) |

Example:

```
/api/reflection-score?bioguideId=T000488&tags=healthcare,tax-relief&stance_healthcare=support&stance_tax-relief=oppose&includeVotes=1
```

Both voting and reflection endpoints return `"source": "database"`.

## Data sources

| Source | Used for | Runtime |
|--------|----------|---------|
| **Supabase** (`roll_call_*`, `bills`) | Voting records, reflection score, bill summaries | Read at request time |
| **US Census Geocoder** | Address → current congressional district (119th) | Live (free) |
| **Congress.gov API** | District → current House/Senate members; CRS summaries | Live |
| **Geocodio** | Address → legislators (fallback) | Live |
| **CIV.IQ** | Address / officials fallback | Live |
| **unitedstates/congress** | Official House + Senate roll-call JSON + bill metadata | Batch scrape → ingest |
| **Demo mode** | Mock officials when all lookups fail | Live fallback |

Congress.gov is **not** the primary path for roll-call votes. Senate and House votes both come from ingested unitedstates data once the pipeline has run.

Procedural votes are stored but **excluded from reflection scoring** by default (`scoring_relevant`, migration `006`).

## Issue tags

~**28** curated slugs in `src/lib/constants/issue-tags.ts` (e.g. healthcare, border-security, less-government-spending, climate-environment). Users pick **3–8** during onboarding.

| Concept | Where |
|---------|--------|
| Tag catalog + pro/anti graph | `src/lib/constants/issue-tags.ts` |
| Graph helpers (sort, highlights) | `src/lib/constants/issue-tag-graph.ts` |
| Demographic ranking | `src/lib/demographics/suggest-tags.ts` |
| Bill `issue_slugs` (federal) | `scripts/tag-bills` → `bills.issue_slugs` |
| Bill `issue_slugs` (state) | `scripts/tag-state-bills` → `state_bills.issue_slugs` |
| Legacy slug aliases | `src/lib/legislation/bill-tag-aliases.ts` |

## Privacy model

- `profiles` — username, avatar, **district only** (community-visible)
- `user_demographics` — income bracket, education, issue tags + stances (RLS: owner-only)
- `saved_representatives` — user's saved officials (owner-only)
- `user_reflection_overrides` — per-bill alignment overrides (owner-only)

## Project layout

```
docs/design/                 Design notes (congress + state ingestion)
data/openstates/             Cached Open States bulk downloads (gitignored)
public/logo.jpg              App logo + favicon (src/app/icon.jpg)
scripts/download-openstates/ Open States session CSV + people download
scripts/ingest-state/         Open States CSV → Supabase state_* tables
scripts/tag-state-bills/     State bill issue_slugs (subject map)
scripts/ingest-congress/     unitedstates JSON → Supabase upsert
scripts/tag-bills/           Federal bill issue_slugs (subject map + Ollama)
src/app/api/                 Next.js API routes
src/app/profile/             Profile editor page
src/components/layout/       AppLogo, SiteNav (auth-aware)
src/components/onboarding/   IssueTagPicker, OnboardingWizard
src/components/dashboard/    OfficialReflectionTabs, ReflectionEvidence
src/components/profile/      ProfileEditor, DemographicsFields
src/lib/constants/           Issue tag catalog + pro/anti graph
src/lib/external/            Census geocoder, Congress.gov, Geocodio, CIV.IQ
src/lib/legislation/         Scoring, dedupe, bill display, vote-scoring filter
src/lib/reflection/          Alignment overrides + UI helpers
supabase/migrations/         SQL schema (001–009)
```

## Roadmap

- [x] District forum UI + Supabase Realtime
- [x] unitedstates/congress ingest pipeline
- [x] DB-backed `/api/voting-records` and `/api/reflection-score`
- [x] Bill tagging scripts (subject map + Ollama with explain dry-run)
- [x] Expanded issue tag catalog with pro/anti onboarding picker
- [x] Stance-aware reflection scoring (support / oppose)
- [x] Bill evidence UI (title + summary on dashboard)
- [x] Procedural vote filtering
- [x] House + Senate reflection tabs; Senate LIS ID fixes
- [x] Profile page (username, demographics, issue tags)
- [x] Per-bill reflection overrides (You support / oppose)
- [x] Current 119th congressional district lookup (Census geocoder)
- [ ] Re-tag bills after tag catalog changes (`npm run tag -- --force`)
- [ ] Scheduled scrape + ingest (cron / GitHub Actions)
- [ ] YouTube curated feed per representative

## License

Private / unlicensed — add your license as needed.
