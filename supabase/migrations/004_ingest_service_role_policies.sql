-- Fix ingest batch writes: service_role policies + ingest_runs without RLS
-- Run in Supabase SQL editor if ingest fails with RLS errors.

-- ingest_runs is never exposed to the browser; disable RLS on audit table only.
alter table public.ingest_runs disable row level security;

-- Explicit full access for service_role (batch ingest script key).
-- The service role JWT normally bypasses RLS; these policies cover edge cases
-- and document intended access.

create policy "bills_service_role_all"
  on public.bills for all to service_role
  using (true) with check (true);

create policy "roll_call_votes_service_role_all"
  on public.roll_call_votes for all to service_role
  using (true) with check (true);

create policy "roll_call_positions_service_role_all"
  on public.roll_call_positions for all to service_role
  using (true) with check (true);

create policy "ingest_runs_service_role_all"
  on public.ingest_runs for all to service_role
  using (true) with check (true);
