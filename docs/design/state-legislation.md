# State legislation & roll-call ingest (Open States → Supabase)

## Goal

Extend CivicMirror reflection scoring and bill evidence to **state legislators** (House + Senate in each state), using the same batch-download → ingest → tag → serve pattern as federal unitedstates/congress data.

**MVP target:** Florida (`FL`), **2026** regular session, floor-relevant votes only.

## Source: [Open States / Plural bulk data](https://open.pluralpolicy.com/data/)

| Aspect | Detail |
|--------|--------|
| Bulk format | Per-session **CSV zip** (bills, votes, vote_people, abstracts, …) |
| Legislators | API `GET /people` (paginated) → `people/current.json` | Nightly CSV at `people/current/{ST}.csv` often returns 403; API is reliable |
| Live lookup | Open States **API v3** — `people.geo` for address → legislators |
| License | Public domain (attribution appreciated) |
| API key | **Required** for bulk S3 downloads (`X-API-KEY`); anon requests return 403 |

Session download URLs are **not stable** (hash suffixes). Resolve them from jurisdiction metadata:

```
GET /jurisdictions/ocd-jurisdiction/country:us/state:fl/government?include=legislative_sessions
→ legislative_sessions[].downloads[].url
```

### Example CSV shapes (FL 2026)

**bills:** `id` (ocd-bill/…), `identifier` (HB 781), `title`, `subject`, `session_identifier`, `organization_classification` (lower\|upper)

**votes:** `id` (ocd-vote/…), `motion_text`, `motion_classification`, `start_date`, `result`, `bill_id`, `session_identifier`

**vote_people:** `vote_event_id`, `option` (yes\|no\|…), `voter_id` (ocd-person/…), `voter_name`

**people:** `id`, `name`, `current_party`, `current_district`, `current_chamber` (upper\|lower)

## Why parallel tables (not extend federal `bills`)

Federal schema assumes Bioguide IDs, `congress` integer, and `house`/`senate` chambers. State data uses **ocd-person**, **ocd-bill**, **ocd-vote**, and `lower`/`upper` chambers.

| Approach | Verdict |
|----------|---------|
| Add `jurisdiction` to existing tables | High risk to federal reflection; painful CHECK constraint migrations |
| **Parallel `state_*` tables** | Safer rollback on `feature/state-legislation`; unified query layer in app code |

## Architecture

```
┌──────────────────────────┐     ┌─────────────────────────┐     ┌──────────────────┐
│ scripts/download-openstates│     │ scripts/ingest-state     │     │ Supabase          │
│ API → session zip URLs    │────▶│ CSV normalize + upsert   │────▶│ state_bills       │
│ + people/current/{ST}.csv │     │ (future)                 │     │ state_roll_call_* │
└──────────────────────────┘     └─────────────────────────┘     └─────────┬────────┘
                                                                            │
┌──────────────────────────┐     ┌─────────────────────────┐              │
│ Census geocoder → lat/lng │     │ scripts/tag-state-bills  │              │
│ + API people.geo          │     │ (future)                 │              │
└──────────────────────────┘     └─────────────────────────┘              │
                                                                            ▼
                                                                  ┌──────────────────┐
                                                                  │ reflection-score │
                                                                  │ + dashboard tabs │
                                                                  └──────────────────┘
```

## ID conventions (planned)

| Entity | ID format | Example |
|--------|-----------|---------|
| State bill | `ocd-bill/{uuid}` | stored as-is in `state_bills.bill_id` |
| Vote | `ocd-vote/{uuid}` | `state_roll_call_votes.vote_id` |
| Legislator | `ocd-person/{uuid}` | `state_legislators.person_id` |
| Jurisdiction | `ocd-jurisdiction/country:us/state:{abbr}/government` | FL |

Display bill key for UI: `{identifier}` e.g. `HB 781` with `state` + `session` context.

## Address → state legislators (runtime)

1. Census **locations** geocoder → `lat`, `lng` (reuse existing address parse).
2. `GET /people.geo?lat=&lng=` with API key.
3. Filter results where `jurisdiction.classification === 'state'` and state matches user.
4. Save as `saved_representatives` with `chamber: 'state'`, new `person_id` column (migration 009).

Do **not** use 2018 boundary GeoJSON for point-in-polygon in MVP.

## Scoring rules (planned)

1. Reuse `pick-issue-match.ts` and `computeReflectionScore` with normalized positions (`yes` → `Yea`).
2. **`scoring_relevant`:** exclude `committee-passage` and other procedural motions by default (FL data is committee-heavy).
3. **Dedupe:** one evidence row per bill per legislator (reuse `dedupe-votes-by-bill.ts` logic).
4. **Overrides:** extend `user_reflection_overrides` to key on `person_id` for state reps.

## Session selection (download CLI)

| Flag | Behavior |
|------|----------|
| `--state FL` | One state (required unless `--all-states`) |
| `--year 2026` | Sessions whose `identifier` is `2026` or starts with `2026` |
| (download default) | **Regular session only** — `identifier === year` exactly |
| `--include-special-sessions` (download) | Also `2026D`, `2026E`, … |
| `--session 2026` | Explicit single session identifier |
| `--all-states` | Every state jurisdiction (heavy) |

**Ingest** (`scripts/ingest-state`): `--year 2026` ingests every matching session **folder on disk** (regular + specials if downloaded). Use `--regular-session-only` to ingest only `2026`.

## Migration 009 (planned, not yet applied)

- `state_legislators`, `state_bills`, `state_roll_call_votes`, `state_roll_call_positions`
- View `state_member_votes_enriched`
- `saved_representatives.person_id`
- `profiles.state_house_district`, `profiles.state_senate_district` (or JSON)
- `ingest_runs.source` includes `openstates/csv`

## Phased delivery

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 0 | Branch + design doc + download script | **Done** |
| 1 | `scripts/download-openstates` | **Done** |
| 2 | Migration `009_state_legislation.sql` | **Done** (apply in Supabase) |
| 3 | `scripts/ingest-state` | **Done** |
| 4 | `scripts/tag-state-bills` | Pending |
| 5 | Lookup (`people.geo`) + onboarding save | Pending |
| 6 | `member-votes-db` + `/api/reflection-score` | Pending |
| 7 | Dashboard state House/Senate tabs | Pending |

## Environment

```bash
# Primary (used by CivicMirror download script)
OPENSTATES_PLURAL_API_KEY=

# Alias accepted by pyopenstates and some Open States tooling
OPENSTATES_API_KEY=

OPENSTATES_DATA_DIR=../../data/openstates   # optional; default under repo data/
```

## Attribution

Display where appropriate: *Data from [Open States](https://open.pluralpolicy.com/data/).*
