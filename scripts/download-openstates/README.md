# Open States bulk download (→ local cache for ingest)

Downloads per-session **CSV zip** archives and a **legislator cache** (`people/current.json` via API) from [Open States](https://open.pluralpolicy.com/data/). See [design doc](../../docs/design/state-legislation.md).

This is **step 1** of the state legislation pipeline (ingest script comes next).

## Prerequisites

1. **API key** — Register at [openstates.org](https://openstates.org/accounts/signup/). Bulk S3 downloads return 403 without `X-API-KEY`.
2. **Node 20+**

## Configure

```bash
cd scripts/download-openstates
cp config.example.env .env
# Set OPENSTATES_PLURAL_API_KEY (or use repo-root .env.local)
npm install
```

## Usage

**Florida 2026 regular session** (recommended MVP test):

```bash
npm run download -- --state FL --year 2026
```

Include 2026 special sessions (`2026D`, `2026E`, `2026F`):

```bash
npm run download -- --state FL --year 2026 --include-special-sessions
```

Explicit session:

```bash
npm run download -- --state FL --session 2026
```

Preview without downloading:

```bash
npm run download:dry -- --state FL --year 2026
```

All states for a year (large):

```bash
npm run download -- --all-states --year 2026
```

Re-download existing archives:

```bash
npm run download -- --state FL --year 2026 --force
```

## Output layout

```
data/openstates/
  FL/
    2026/
      FL_2026_csv_….zip      # session bulk archive
      manifest.json          # session id, url, timestamp
    people/
      current.json           # legislators (API; bulk CSV often 403)
```

`data/openstates/` is gitignored. Point `OPENSTATES_DATA_DIR` to override the default location.

## Session filter rules

| Flags | Sessions included (FL example) |
|-------|-------------------------------|
| `--year 2026` | `2026` only (regular) |
| `--year 2026 --include-special-sessions` | `2026`, `2026D`, `2026E`, `2026F`, … |
| `--session 2026D` | `2026D` only |

Some states use biennium identifiers (e.g. `20252026`); use `--session` when `--year` does not match.

**Ingest:** `scripts/ingest-state --year 2026` picks up every matching session folder on disk (including specials if you downloaded them). Use `--regular-session-only` on ingest to load only `2026`.

## Next steps

- [ ] `scripts/ingest-state` — CSV → Supabase (`009_state_legislation.sql`)
- [ ] `scripts/tag-state-bills` — `issue_slugs` for reflection scoring
- [ ] Address lookup via `people.geo` + dashboard state tabs
