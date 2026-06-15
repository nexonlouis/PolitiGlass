-- PolitiGlass: batch-ingested legislation & roll-call votes (unitedstates/congress)
-- Run after 001_initial_schema.sql and 002_forum_realtime.sql

-- ---------------------------------------------------------------------------
-- Bills (canonical; replaces ad-hoc use of bill_issue_tags for new features)
-- ---------------------------------------------------------------------------

create table public.bills (
  bill_id text primary key,
  congress integer not null,
  bill_type text not null,
  bill_number integer not null,
  title text,
  short_title text,
  summary text,
  subjects text[] not null default '{}',
  issue_slugs text[] not null default '{}',
  introduced_on date,
  source_updated_at timestamptz,
  ingested_at timestamptz not null default timezone('utc', now())
);

create index bills_congress_idx on public.bills (congress);
create index bills_issue_slugs_gin on public.bills using gin (issue_slugs);

-- ---------------------------------------------------------------------------
-- Roll-call votes
-- ---------------------------------------------------------------------------

create table public.roll_call_votes (
  vote_id text primary key,
  congress integer not null,
  session text not null,
  chamber text not null check (chamber in ('house', 'senate')),
  roll_number integer not null,
  voted_at timestamptz not null,
  question text,
  vote_type text,
  category text,
  result text,
  requires_threshold text,
  source_url text,
  related_bill_id text references public.bills (bill_id) on delete set null,
  source_updated_at timestamptz,
  ingested_at timestamptz not null default timezone('utc', now()),
  unique (congress, session, chamber, roll_number)
);

create index roll_call_votes_voted_at_idx on public.roll_call_votes (voted_at desc);
create index roll_call_votes_bill_idx on public.roll_call_votes (related_bill_id);
create index roll_call_votes_congress_chamber_idx on public.roll_call_votes (congress, chamber);
create index roll_call_votes_category_idx on public.roll_call_votes (category);

-- ---------------------------------------------------------------------------
-- Per-member positions on each roll-call vote
-- ---------------------------------------------------------------------------

create table public.roll_call_positions (
  vote_id text not null references public.roll_call_votes (vote_id) on delete cascade,
  bioguide_id text not null,
  position text not null check (
    position in ('Yea', 'Nay', 'Not Voting', 'Present', 'Present, Voting')
  ),
  party text,
  state text,
  primary key (vote_id, bioguide_id)
);

create index roll_call_positions_bioguide_idx on public.roll_call_positions (bioguide_id);
create index roll_call_positions_vote_idx on public.roll_call_positions (vote_id);

-- ---------------------------------------------------------------------------
-- Ingest audit log
-- ---------------------------------------------------------------------------

create table public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'unitedstates/congress',
  congress integer,
  mode text not null check (mode in ('full', 'fast', 'votes_only', 'bills_only')),
  status text not null check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  votes_processed integer not null default 0,
  votes_upserted integer not null default 0,
  bills_processed integer not null default 0,
  bills_upserted integer not null default 0,
  errors_count integer not null default 0,
  error_sample text
);

create index ingest_runs_started_at_idx on public.ingest_runs (started_at desc);

-- ---------------------------------------------------------------------------
-- Link legacy bill_issue_tags to bills (optional FK; rows can predate bills)
-- ---------------------------------------------------------------------------

alter table public.bill_issue_tags
  add constraint bill_issue_tags_bill_id_fkey
  foreign key (bill_id) references public.bills (bill_id) on delete cascade
  not valid;

-- Validate after first ingest backfill:
-- alter table public.bill_issue_tags validate constraint bill_issue_tags_bill_id_fkey;

-- ---------------------------------------------------------------------------
-- Category weights for reflection score (optional reference data)
-- ---------------------------------------------------------------------------

create table public.vote_category_weights (
  category text primary key,
  weight numeric(3, 2) not null check (weight > 0 and weight <= 1)
);

insert into public.vote_category_weights (category, weight) values
  ('passage', 1.00),
  ('passage-suspension', 0.85),
  ('amendment', 0.70),
  ('cloture', 0.50),
  ('nomination', 0.40),
  ('treaty', 0.40),
  ('recommit', 0.35),
  ('procedural', 0.30),
  ('quorum', 0.20),
  ('leadership', 0.20),
  ('veto-override', 1.00),
  ('unknown', 0.50)
on conflict (category) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.bills enable row level security;
alter table public.roll_call_votes enable row level security;
alter table public.roll_call_positions enable row level security;
alter table public.ingest_runs enable row level security;
alter table public.vote_category_weights enable row level security;

-- Public read for authenticated app users
create policy "bills_select_authenticated"
  on public.bills for select to authenticated using (true);

create policy "roll_call_votes_select_authenticated"
  on public.roll_call_votes for select to authenticated using (true);

create policy "roll_call_positions_select_authenticated"
  on public.roll_call_positions for select to authenticated using (true);

create policy "vote_category_weights_select_authenticated"
  on public.vote_category_weights for select to authenticated using (true);

-- ingest_runs: no client access (service role only)

-- ---------------------------------------------------------------------------
-- Helper view: member votes with bill + issue tags (for API layer)
-- ---------------------------------------------------------------------------

create or replace view public.member_votes_enriched as
select
  p.bioguide_id,
  p.position,
  p.party,
  p.state,
  v.vote_id,
  v.voted_at,
  v.chamber,
  v.congress,
  v.category,
  v.question,
  v.result,
  v.related_bill_id,
  b.title as bill_title,
  b.issue_slugs as bill_issue_slugs,
  coalesce(w.weight, 0.5) as category_weight
from public.roll_call_positions p
join public.roll_call_votes v on v.vote_id = p.vote_id
left join public.bills b on b.bill_id = v.related_bill_id
left join public.vote_category_weights w on w.category = v.category;

-- Views use invoker permissions; RLS on underlying tables still applies.
