-- Manual per-bill alignment overrides for reflection scoring (user + official + bill).

create table public.user_reflection_overrides (
  user_id uuid references auth.users on delete cascade not null,
  bioguide_id text not null,
  bill_id text not null,
  aligned boolean not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, bioguide_id, bill_id)
);

create index user_reflection_overrides_user_bioguide_idx
  on public.user_reflection_overrides (user_id, bioguide_id);

alter table public.user_reflection_overrides enable row level security;

create policy "reflection_overrides_select_own"
  on public.user_reflection_overrides for select to authenticated
  using (auth.uid() = user_id);

create policy "reflection_overrides_insert_own"
  on public.user_reflection_overrides for insert to authenticated
  with check (auth.uid() = user_id);

create policy "reflection_overrides_update_own"
  on public.user_reflection_overrides for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "reflection_overrides_delete_own"
  on public.user_reflection_overrides for delete to authenticated
  using (auth.uid() = user_id);
