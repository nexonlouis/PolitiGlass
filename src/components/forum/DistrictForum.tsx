"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { aggregateVotes, type VoteRow } from "@/lib/forum/aggregate-votes";
import { CreatePostForm } from "@/components/forum/CreatePostForm";
import { PostCard } from "@/components/forum/PostCard";
import type { ForumComment, ForumPost } from "@/lib/types/forum";

interface DistrictForumProps {
  /** When embedded on dashboard, pass district from parent if known */
  initialDistrict?: string | null;
  initialIssueTags?: string[];
  compact?: boolean;
}

type PostRow = {
  id: string;
  title: string;
  body: string;
  issue_slug: string | null;
  created_at: string;
  author_id: string;
  profiles: { username: string } | { username: string }[] | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  author_id: string;
  profiles: { username: string } | { username: string }[] | null;
};

function profileUsername(
  profiles: PostRow["profiles"],
): string {
  if (!profiles) return "neighbor";
  if (Array.isArray(profiles)) return profiles[0]?.username ?? "neighbor";
  return profiles.username;
}

export function DistrictForum({
  initialDistrict = null,
  initialIssueTags = [],
  compact = false,
}: DistrictForumProps) {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [district, setDistrict] = useState<string | null>(initialDistrict);
  const [issueTags, setIssueTags] = useState<string[]>(initialIssueTags);
  const [filterSlug, setFilterSlug] = useState<string | "all">("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canParticipate =
    signedIn && district && district !== "unassigned";

  useEffect(() => {
    if (initialDistrict) setDistrict(initialDistrict);
    if (initialIssueTags.length > 0) setIssueTags(initialIssueTags);
  }, [initialDistrict, initialIssueTags]);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setSignedIn(!!user);
      setUserId(user?.id ?? null);
      if (!user) return;

      if (!initialDistrict) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("congressional_district")
          .eq("id", user.id)
          .single();
        if (profile?.congressional_district) {
          setDistrict(profile.congressional_district);
        }
      }

      if (initialIssueTags.length === 0) {
        const { data: demo } = await supabase
          .from("user_demographics")
          .select("saved_issue_tags")
          .eq("user_id", user.id)
          .single();
        if (demo?.saved_issue_tags?.length) {
          setIssueTags(demo.saved_issue_tags);
        }
      }
    }
    void loadProfile();
  }, [initialDistrict, initialIssueTags]);

  const loadPosts = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = supabase
      .from("district_posts")
      .select(
        "id, title, body, issue_slug, created_at, author_id, profiles(username)",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (filterSlug !== "all") {
      query = query.eq("issue_slug", filterSlug);
    }

    const { data: postRows, error: postsError } = await query;

    if (postsError) {
      throw new Error(postsError.message);
    }

    const rows = (postRows ?? []) as PostRow[];
    const postIds = rows.map((p) => p.id);

    let votes: VoteRow[] = [];
    if (postIds.length > 0) {
      const { data: voteRows } = await supabase
        .from("post_votes")
        .select("post_id, user_id, value")
        .in("post_id", postIds);
      votes = (voteRows ?? []) as VoteRow[];
    }

    const voteMap = aggregateVotes(votes, user?.id ?? null);

    let commentCounts = new Map<string, number>();
    if (postIds.length > 0) {
      const { data: commentRows } = await supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds);
      for (const c of commentRows ?? []) {
        const pid = (c as { post_id: string }).post_id;
        commentCounts.set(pid, (commentCounts.get(pid) ?? 0) + 1);
      }
    }

    const mapped: ForumPost[] = rows.map((p) => {
      const v = voteMap.get(p.id);
      return {
        id: p.id,
        title: p.title,
        body: p.body,
        issueSlug: p.issue_slug,
        createdAt: p.created_at,
        authorId: p.author_id,
        authorUsername: profileUsername(p.profiles),
        score: v?.score ?? 0,
        userVote: v?.userVote ?? null,
        commentCount: commentCounts.get(p.id) ?? 0,
      };
    });

    setPosts(mapped);
  }, [district, filterSlug]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadPosts()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load forum"))
      .finally(() => setLoading(false));
  }, [loadPosts]);

  useEffect(() => {
    if (!district || district === "unassigned") return;

    const supabase = createClient();
    const channel = supabase
      .channel(`district-forum-${district}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "district_posts",
          filter: `congressional_district=eq.${district}`,
        },
        () => {
          void loadPosts();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments" },
        () => {
          void loadPosts();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_votes" },
        () => {
          void loadPosts();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [district, loadPosts]);

  const createPost = async (input: {
    title: string;
    body: string;
    issueSlug: string | null;
  }) => {
    if (!userId || !district) throw new Error("Not ready to post");

    const supabase = createClient();
    const { error: insertError } = await supabase.from("district_posts").insert({
      author_id: userId,
      congressional_district: district,
      title: input.title,
      body: input.body,
      issue_slug: input.issueSlug,
    });

    if (insertError) throw new Error(insertError.message);
    await loadPosts();
  };

  const handleVote = async (postId: string, direction: 1 | -1) => {
    if (!userId) return;

    const supabase = createClient();
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    if (post.userVote === direction) {
      const { error } = await supabase
        .from("post_votes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else if (post.userVote) {
      const { error } = await supabase
        .from("post_votes")
        .update({ value: direction })
        .eq("post_id", postId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("post_votes").insert({
        post_id: postId,
        user_id: userId,
        value: direction,
      });
      if (error) throw new Error(error.message);
    }

    await loadPosts();
  };

  const loadComments = async (postId: string): Promise<ForumComment[]> => {
    const supabase = createClient();
    const { data, error: commentsError } = await supabase
      .from("post_comments")
      .select("id, post_id, body, created_at, author_id, profiles(username)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (commentsError) throw new Error(commentsError.message);

    return ((data ?? []) as CommentRow[]).map((c) => ({
      id: c.id,
      postId: c.post_id,
      body: c.body,
      createdAt: c.created_at,
      authorId: c.author_id,
      authorUsername: profileUsername(c.profiles),
    }));
  };

  const addComment = async (postId: string, body: string) => {
    if (!userId) throw new Error("Sign in to comment");

    const supabase = createClient();
    const { error: insertError } = await supabase.from("post_comments").insert({
      post_id: postId,
      author_id: userId,
      body,
    });

    if (insertError) throw new Error(insertError.message);
  };

  const disabledReason = !signedIn
    ? "Sign in to post in your district forum."
    : !district || district === "unassigned"
      ? "Complete onboarding with your address to join your district forum."
      : undefined;

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {!compact && (
        <div>
          <h2 className="text-2xl font-bold tracking-tight">District forum</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Discuss local civic issues with others in{" "}
            <span className="font-medium">{district ?? "your district"}</span>.
            Only your username and district are visible — never your address or
            demographics.
          </p>
        </div>
      )}

      {!signedIn && (
        <p className="text-sm text-slate-600">
          <Link href="/auth?next=/forum" className="underline">
            Sign in
          </Link>{" "}
          to post and vote.
        </p>
      )}

      <CreatePostForm
        issueTags={issueTags}
        disabled={!canParticipate}
        disabledReason={disabledReason}
        onSubmit={createPost}
      />

      {issueTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={filterSlug === "all"}
            label="All"
            onClick={() => setFilterSlug("all")}
          />
          {issueTags.map((slug) => (
            <FilterChip
              key={slug}
              active={filterSlug === slug}
              label={slug.replace(/-/g, " ")}
              onClick={() => setFilterSlug(slug)}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
          {error.includes("Supabase") || error.includes("JWT") ? (
            <span> Check NEXT_PUBLIC_SUPABASE_URL and keys in .env.local.</span>
          ) : null}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading discussions…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-slate-600">
          No posts yet. Be the first to start a conversation in your district.
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard
                post={post}
                signedIn={signedIn}
                onVote={handleVote}
                onLoadComments={loadComments}
                onAddComment={addComment}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm capitalize transition-colors ${
        active
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          : "border border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
