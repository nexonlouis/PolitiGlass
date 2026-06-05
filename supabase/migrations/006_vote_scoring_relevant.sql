-- Flag procedural / process votes that should not affect reflection scoring.

alter table public.roll_call_votes
  add column if not exists scoring_relevant boolean not null default true;

create index if not exists roll_call_votes_scoring_relevant_idx
  on public.roll_call_votes (scoring_relevant)
  where scoring_relevant = true;

-- Backfill existing rows (mirrors src/lib/legislation/vote-scoring.ts heuristics)
update public.roll_call_votes
set scoring_relevant = false
where category in ('procedural', 'quorum', 'leadership', 'recommit')
   or question ~* '^On Motion to Adjourn'
   or question ~* '^On Ordering the Previous Question'
   or question ~* '^On Motion to Recommit:'
   or question ~* '^On Motion to Discharge:'
   or question ~* '^On Motion to Table'
   or question ~* '^On Agreeing to the Resolution: H\.? RES\.? [0-9]+ Providing for consideration'
   or question ~* '^On Agreeing to the Resolution:.*Providing for consideration of the bill'
   or question ~* '^On Agreeing to the Resolution:.*Providing for consideration of the bills'
   or question ~* 'Providing for disposition of the Senate amendment'
   or question ~* '^On Waiving.*clause.*rule'
   or question ~* '^On Motion to Proceed';

-- CREATE OR REPLACE cannot insert columns mid-list; append scoring_relevant at the end.
drop view if exists public.member_votes_enriched;

create view public.member_votes_enriched as
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
  coalesce(w.weight, 0.5) as category_weight,
  v.scoring_relevant
from public.roll_call_positions p
join public.roll_call_votes v on v.vote_id = p.vote_id
left join public.bills b on b.bill_id = v.related_bill_id
left join public.vote_category_weights w on w.category = v.category;
