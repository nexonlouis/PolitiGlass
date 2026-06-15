-- PolitiGlass initial schema: split public profiles from private demographics

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar_url text,
  congressional_district text not null default 'unassigned',
  state text,
  ocd_division_id text,
  lookup_zip text,
  onboarding_completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_demographics (
  user_id uuid references auth.users on delete cascade primary key,
  birth_year integer,
  education_level text,
  income_bracket text,
  has_children boolean,
  saved_issue_tags text[] not null default '{}',
  issue_tag_weights jsonb not null default '{}',
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.saved_representatives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  bioguide_id text not null,
  full_name text not null,
  chamber text not null check (chamber in ('house', 'senate', 'state')),
  party text,
  photo_url text,
  state text,
  district text,
  looked_up_at timestamptz not null default timezone('utc', now()),
  unique (user_id, bioguide_id)
);

create table public.bill_issue_tags (
  bill_id text primary key,
  congress integer not null,
  bill_type text not null,
  bill_number integer not null,
  title text,
  issue_slugs text[] not null default '{}',
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.district_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles (id) on delete cascade not null,
  congressional_district text not null,
  issue_slug text,
  title text not null,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.district_posts on delete cascade not null,
  author_id uuid references public.profiles (id) on delete cascade not null,
  body text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.post_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.district_posts on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default timezone('utc', now()),
  unique (post_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index district_posts_district_idx on public.district_posts (congressional_district);
create index district_posts_issue_idx on public.district_posts (issue_slug);
create index saved_representatives_user_idx on public.saved_representatives (user_id);

-- ---------------------------------------------------------------------------
-- New user trigger
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, congressional_district)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 8),
    'unassigned'
  );
  insert into public.user_demographics (user_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_demographics enable row level security;
alter table public.saved_representatives enable row level security;
alter table public.bill_issue_tags enable row level security;
alter table public.district_posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_votes enable row level security;

-- profiles
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated using (true);

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- user_demographics (owner only)
create policy "demographics_select_own"
  on public.user_demographics for select to authenticated
  using (auth.uid() = user_id);

create policy "demographics_insert_own"
  on public.user_demographics for insert to authenticated
  with check (auth.uid() = user_id);

create policy "demographics_update_own"
  on public.user_demographics for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "demographics_delete_own"
  on public.user_demographics for delete to authenticated
  using (auth.uid() = user_id);

-- saved_representatives
create policy "saved_reps_select_own"
  on public.saved_representatives for select to authenticated
  using (auth.uid() = user_id);

create policy "saved_reps_insert_own"
  on public.saved_representatives for insert to authenticated
  with check (auth.uid() = user_id);

create policy "saved_reps_update_own"
  on public.saved_representatives for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "saved_reps_delete_own"
  on public.saved_representatives for delete to authenticated
  using (auth.uid() = user_id);

-- bill_issue_tags: read for authenticated; writes via service role only
create policy "bill_tags_select_authenticated"
  on public.bill_issue_tags for select to authenticated using (true);

-- district_posts: same congressional district
create policy "district_posts_select_same_district"
  on public.district_posts for select to authenticated
  using (
    congressional_district = (
      select congressional_district from public.profiles where id = auth.uid()
    )
  );

create policy "district_posts_insert_same_district"
  on public.district_posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and congressional_district = (
      select congressional_district from public.profiles where id = auth.uid()
    )
  );

create policy "district_posts_update_own"
  on public.district_posts for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "district_posts_delete_own"
  on public.district_posts for delete to authenticated
  using (author_id = auth.uid());

-- post_comments: visible if post is visible (same district via join)
create policy "post_comments_select"
  on public.post_comments for select to authenticated
  using (
    exists (
      select 1 from public.district_posts p
      where p.id = post_id
        and p.congressional_district = (
          select congressional_district from public.profiles where id = auth.uid()
        )
    )
  );

create policy "post_comments_insert"
  on public.post_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.district_posts p
      where p.id = post_id
        and p.congressional_district = (
          select congressional_district from public.profiles where id = auth.uid()
        )
    )
  );

-- post_votes
create policy "post_votes_select"
  on public.post_votes for select to authenticated using (true);

create policy "post_votes_upsert_own"
  on public.post_votes for insert to authenticated
  with check (auth.uid() = user_id);

create policy "post_votes_update_own"
  on public.post_votes for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "post_votes_delete_own"
  on public.post_votes for delete to authenticated
  using (auth.uid() = user_id);
