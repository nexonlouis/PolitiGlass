# CivicMirror

Nonpartisan civic engagement app: find your elected officials, personalize issue priorities, and track voting alignment.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS
- **Supabase** — Auth, PostgreSQL, RLS, Realtime (forum UI stubbed)
- **External data** — Geocodio / CIV.IQ (lookup), Congress.gov (House votes), demo mode fallback

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

For live official lookup, set your Congress.gov key and use a full address:

```env
CONGRESS_GOV_API_KEY=your_key
CIVIC_MIRROR_DEMO_MODE=false
```

Optional: `GEOCODIO_API_KEY` for Geocodio-first lookup.

### 3. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run migrations in the SQL editor: `001`–`006` (including `006_vote_scoring_relevant.sql`)
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and optionally `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`.
4. Enable Email auth under Authentication → Providers.

### 4. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

| Path | Description |
|------|-------------|
| `/` | Landing |
| `/onboarding` | 4-step calibration flow |
| `/auth` | Sign up / sign in |
| `/dashboard` | Officials, reflection score, forum preview |
| `/forum` | District discussion board (posts, votes, comments) |

## API routes

| Route | Method | Auth |
|-------|--------|------|
| `/api/lookup-representatives` | POST | No |
| `/api/suggest-tags` | POST | No |
| `/api/voting-records` | GET | No |
| `/api/health/data-sources` | GET | No |
| `/api/reflection-score` | GET | No |
| `/api/onboarding/complete` | POST | Yes |

## Data sources

- **Geocodio** — address → legislators ([geocod.io](https://www.geocod.io/))
- **CIV.IQ** — fallback / unified civic API ([civdotiq.org](https://www.civdotiq.org/developers))
- **Congress.gov API** — current members + House roll-call votes ([api.congress.gov](https://api.congress.gov/))
- **US Census Geocoder** — address → congressional district (free, no key)
- **LegiScan / CIV.IQ** — recommended for Senate and state votes (not wired in MVP)

## Privacy model

- `profiles` — username, avatar, **district only** (community-visible)
- `user_demographics` — income bracket, education, issue tags (RLS: owner-only)

## Congress vote ingestion (batch)

For House **and** Senate roll-call data, CivicMirror uses [unitedstates/congress](https://github.com/unitedstates/congress) scraped to JSON, then batch-loaded into Supabase.

- **Design:** [docs/design/congress-vote-ingestion.md](docs/design/congress-vote-ingestion.md)
- **Ingest scripts:** [scripts/ingest-congress/](scripts/ingest-congress/)

## Next steps

- [x] District discussion board UI + Supabase Realtime
- [x] Run congress ingest backfill + switch API routes to DB reads
- [ ] Bill → issue tag cache + LLM batch labeling
- [ ] YouTube curated feed per representative

## License

Private / unlicensed — add your license as needed.
