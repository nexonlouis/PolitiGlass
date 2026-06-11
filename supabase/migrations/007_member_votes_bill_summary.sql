-- Expose bill summary on member_votes_enriched for reflection evidence UI.

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
  b.summary as bill_summary,
  b.issue_slugs as bill_issue_slugs,
  coalesce(w.weight, 0.5) as category_weight,
  v.scoring_relevant
from public.roll_call_positions p
join public.roll_call_votes v on v.vote_id = p.vote_id
left join public.bills b on b.bill_id = v.related_bill_id
left join public.vote_category_weights w on w.category = v.category;
