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

For local UI exploration without API keys, keep:

```env
CIVIC_MIRROR_DEMO_MODE=true
```

### 3. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migration in the SQL editor: `supabase/migrations/001_initial_schema.sql`
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
| `/dashboard` | Officials, reflection score, forum placeholder |

## API routes

| Route | Method | Auth |
|-------|--------|------|
| `/api/lookup-representatives` | POST | No |
| `/api/suggest-tags` | POST | No |
| `/api/voting-records` | GET | No |
| `/api/reflection-score` | GET | No |
| `/api/onboarding/complete` | POST | Yes |

## Data sources

- **Geocodio** — address → legislators ([geocod.io](https://www.geocod.io/))
- **CIV.IQ** — fallback / unified civic API ([civdotiq.org](https://www.civdotiq.org/developers))
- **Congress.gov API** — House roll-call votes ([api.congress.gov](https://api.congress.gov/))
- **LegiScan / CIV.IQ** — recommended for Senate and state votes (not wired in MVP)

## Privacy model

- `profiles` — username, avatar, **district only** (community-visible)
- `user_demographics` — income bracket, education, issue tags (RLS: owner-only)

## Next steps

- [ ] District discussion board UI + Supabase Realtime
- [ ] Bill → issue tag cache + LLM batch labeling
- [ ] Senate votes via LegiScan or CIV.IQ
- [ ] YouTube curated feed per representative

## License

Private / unlicensed — add your license as needed.
