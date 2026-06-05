"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getIssueTagLabel } from "@/lib/constants/issue-tags";

interface CreatePostFormProps {
  issueTags: string[];
  disabled: boolean;
  disabledReason?: string;
  onSubmit: (input: {
    title: string;
    body: string;
    issueSlug: string | null;
  }) => Promise<void>;
}

export function CreatePostForm({
  issueTags,
  disabled,
  disabledReason,
  onSubmit,
}: CreatePostFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [issueSlug, setIssueSlug] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        body: body.trim(),
        issueSlug: issueSlug || null,
      });
      setTitle("");
      setBody("");
      setIssueSlug("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create post");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)} disabled={disabled}>
          New discussion
        </Button>
        {disabled && disabledReason && (
          <p className="mt-2 text-sm text-slate-500">{disabledReason}</p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <h3 className="font-semibold">Start a discussion</h3>
      <div className="mt-3 space-y-3">
        <Input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        <textarea
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
          placeholder="What do you want to discuss with neighbors in your district?"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
        />
        <label className="block text-sm">
          Issue tag (optional)
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
            value={issueSlug}
            onChange={(e) => setIssueSlug(e.target.value)}
          >
            <option value="">General</option>
            {issueTags.map((slug) => (
              <option key={slug} value={slug}>
                {getIssueTagLabel(slug)}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Posting…" : "Post"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
