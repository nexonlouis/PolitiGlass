"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getIssueTagLabel } from "@/lib/constants/issue-tags";
import { formatRelativeTime } from "@/lib/forum/format-time";
import type { ForumComment, ForumPost } from "@/lib/types/forum";

interface PostCardProps {
  post: ForumPost;
  signedIn: boolean;
  onVote: (postId: string, direction: 1 | -1) => Promise<void>;
  onLoadComments: (postId: string) => Promise<ForumComment[]>;
  onAddComment: (postId: string, body: string) => Promise<void>;
}

export function PostCard({
  post,
  signedIn,
  onVote,
  onLoadComments,
  onAddComment,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const openComments = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (comments.length > 0) return;
    setLoadingComments(true);
    try {
      const loaded = await onLoadComments(post.id);
      setComments(loaded);
    } finally {
      setLoadingComments(false);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setSubmittingComment(true);
    try {
      await onAddComment(post.id, commentBody.trim());
      const loaded = await onLoadComments(post.id);
      setComments(loaded);
      setCommentBody("");
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex gap-3 p-4">
        <div className="flex w-10 shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            aria-label="Upvote"
            disabled={!signedIn}
            onClick={() => onVote(post.id, 1)}
            className={`rounded px-1 text-lg leading-none ${
              post.userVote === 1
                ? "text-orange-600"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            ▲
          </button>
          <span className="text-sm font-semibold tabular-nums">{post.score}</span>
          <button
            type="button"
            aria-label="Downvote"
            disabled={!signedIn}
            onClick={() => onVote(post.id, -1)}
            className={`rounded px-1 text-lg leading-none ${
              post.userVote === -1
                ? "text-indigo-600"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            ▼
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {post.authorUsername}
            </span>
            <span>·</span>
            <time dateTime={post.createdAt}>{formatRelativeTime(post.createdAt)}</time>
            {post.issueSlug && (
              <>
                <span>·</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                  {getIssueTagLabel(post.issueSlug)}
                </span>
              </>
            )}
          </div>
          <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
            {post.title}
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
            {post.body}
          </p>
          <button
            type="button"
            onClick={openComments}
            className="mt-3 text-sm text-slate-500 hover:text-slate-800"
          >
            {expanded
              ? "Hide comments"
              : `${post.commentCount} comment${post.commentCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          {loadingComments ? (
            <p className="text-sm text-slate-500">Loading comments…</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {c.authorUsername}
                  </span>
                  <span className="text-slate-400">
                    {" "}
                    · {formatRelativeTime(c.createdAt)}
                  </span>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">{c.body}</p>
                </li>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-slate-500">No comments yet.</p>
              )}
            </ul>
          )}
          {signedIn ? (
            <form onSubmit={submitComment} className="mt-3 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                placeholder="Add a comment…"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                maxLength={2000}
              />
              <Button type="submit" disabled={submittingComment}>
                Reply
              </Button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              <Link href="/auth?next=/forum" className="underline">
                Sign in
              </Link>{" "}
              to comment.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
