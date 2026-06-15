"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { aggregateVotes, type VoteRow } from "@/lib/forum/aggregate-votes";
import { isPostEdited } from "@/lib/forum/post-edited";
import { CreatePostForm } from "@/components/forum/CreatePostForm";
import { IssueTagChipPicker } from "@/components/forum/IssueTagChipPicker";
import { PostCard } from "@/components/forum/PostCard";
import type { ForumComment, ForumPost } from "@/lib/types/forum";

interface DistrictForumProps {
  initialIssueTags?: string[];
  compact?: boolean;
  /** Shared dashboard filter — when set, overrides internal filter state. */
  filterIssueSlugs?: string[];
  /** Hide in-component filter UI (dashboard provides a shared filter above). */
  hideIssueFilter?: boolean;
}

type PostRow = {
  id: string;
  title: string;
  body: string;
  issue_slugs: string[];
  created_at: string;
  updated_at: string;
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

function profileUsername(profiles: PostRow["profiles"]): string {
  if (!profiles) return "neighbor";
  if (Array.isArray(profiles)) return profiles[0]?.username ?? "neighbor";
  return profiles.username;
}

export function DistrictForum({
  initialIssueTags = [],
  compact = false,
  filterIssueSlugs: filterIssueSlugsProp,
  hideIssueFilter = false,
}: DistrictForumProps) {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [issueTags, setIssueTags] = useState<string[]>(initialIssueTags);
  const [internalFilterIssueSlugs, setInternalFilterIssueSlugs] = useState<string[]>([]);
  const filterIssueSlugs = filterIssueSlugsProp ?? internalFilterIssueSlugs;
  const [userId, setUserId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canParticipate = signedIn;

  useEffect(() => {
    if (initialIssueTags.length > 0) setIssueTags(initialIssueTags);
  }, [initialIssueTags]);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setSignedIn(!!user);
      setUserId(user?.id ?? null);
      if (!user) return;

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
  }, [initialIssueTags]);

  const loadPosts = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = supabase
      .from("district_posts")
      .select(
        "id, title, body, issue_slugs, created_at, updated_at, author_id, profiles(username)",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (filterIssueSlugs.length > 0) {
      query = query.overlaps("issue_slugs", filterIssueSlugs);
    }
    // District list filter removed — shared interests matter more than locality.
    // To restore: track filterDistrict state ("all" | district) and apply:
    // if (filterDistrict !== "all") {
    //   query = query.eq("congressional_district", filterDistrict);
    // }

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
        issueSlugs: p.issue_slugs ?? [],
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        edited: isPostEdited(p.created_at, p.updated_at),
        authorId: p.author_id,
        authorUsername: profileUsername(p.profiles),
        score: v?.score ?? 0,
        userVote: v?.userVote ?? null,
        commentCount: commentCounts.get(p.id) ?? 0,
      };
    });

    setPosts(mapped);
  }, [filterIssueSlugs]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadPosts()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load forum"))
      .finally(() => setLoading(false));
  }, [loadPosts]);

  useEffect(() => {
    if (!signedIn) return;

    const supabase = createClient();
    const channel = supabase
      .channel("community-forum")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "district_posts" },
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
  }, [signedIn, loadPosts]);

  const createPost = async (input: {
    title: string;
    body: string;
    issueSlugs: string[];
  }) => {
    if (!userId) throw new Error("Sign in to post");

    const supabase = createClient();
    const { error: insertError } = await supabase.from("district_posts").insert({
      author_id: userId,
      title: input.title,
      body: input.body,
      issue_slugs: input.issueSlugs,
    });

    if (insertError) throw new Error(insertError.message);
    await loadPosts();
  };

  const editPost = async (
    postId: string,
    input: {
      title: string;
      body: string;
      issueSlugs: string[];
    },
  ) => {
    if (!userId) throw new Error("Sign in to edit");

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("district_posts")
      .update({
        title: input.title,
        body: input.body,
        issue_slugs: input.issueSlugs,
      })
      .eq("id", postId)
      .eq("author_id", userId);

    if (updateError) throw new Error(updateError.message);
    await loadPosts();
  };

  const deletePost = async (postId: string) => {
    if (!userId) throw new Error("Sign in to delete");

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("district_posts")
      .delete()
      .eq("id", postId)
      .eq("author_id", userId);

    if (deleteError) throw new Error(deleteError.message);
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

  const disabledReason = !signedIn ? "Sign in to post in the forum." : undefined;

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {!compact && (
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Community forum</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Discuss civic issues with neighbors across PolitiGlass. Add optional
            issue tags to focus a thread. Only your username is visible — never your
            address or demographics.
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

      {/*
        District filter UI removed — users connect on shared issues more than locality.
        To restore: add filterDistrict state ("all" | district), chip row, and
        query.eq("congressional_district", filterDistrict) in loadPosts.
      */}

      {!hideIssueFilter && filterIssueSlugsProp === undefined && (
      <IssueTagChipPicker
        label="Filter by issue"
        hint="Select one or more issues. Posts matching any selected issue are shown."
        availableSlugs={issueTags}
        selectedSlugs={filterIssueSlugs}
        onChange={setInternalFilterIssueSlugs}
        showAllOption
      />
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
          {filterIssueSlugs.length > 0
            ? "No posts match these filters."
            : "No posts yet. Be the first to start a conversation."}
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard
                post={post}
                signedIn={signedIn}
                currentUserId={userId}
                issueTags={issueTags}
                onVote={handleVote}
                onLoadComments={loadComments}
                onAddComment={addComment}
                onEditPost={editPost}
                onDeletePost={deletePost}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
