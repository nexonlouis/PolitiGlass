-- Enable Realtime for district forum tables (run in Supabase SQL editor after 001)

alter publication supabase_realtime add table public.district_posts;
alter publication supabase_realtime add table public.post_comments;
alter publication supabase_realtime add table public.post_votes;
