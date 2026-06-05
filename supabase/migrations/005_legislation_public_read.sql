-- Allow public API reads of ingested legislation (no PII).
-- Authenticated policies from 003 remain; anon enables unauthenticated /api routes.

create policy "bills_select_anon"
  on public.bills for select to anon using (true);

create policy "roll_call_votes_select_anon"
  on public.roll_call_votes for select to anon using (true);

create policy "roll_call_positions_select_anon"
  on public.roll_call_positions for select to anon using (true);

create policy "vote_category_weights_select_anon"
  on public.vote_category_weights for select to anon using (true);
