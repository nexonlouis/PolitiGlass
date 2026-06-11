"use client";

import { useMemo, useState } from "react";
import { getIssueTagLabel } from "@/lib/constants/issue-tags";
import { congressGovBillTextUrl } from "@/lib/legislation/bill-congress-url";
import type { VoteAlignmentItem } from "@/lib/types";

type Filter = "all" | "aligned" | "diverged";

interface ReflectionEvidenceProps {
  votes: VoteAlignmentItem[];
}

function VoteEvidenceCard({ item }: { item: VoteAlignmentItem }) {
  const [expanded, setExpanded] = useState(false);
  const summary = item.summary?.trim();
  const showToggle = summary && summary.length > 220;
  const billTextUrl = congressGovBillTextUrl(item.billId);

  return (
    <li className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium text-slate-900 dark:text-slate-100">{item.title}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            item.aligned
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300"
          }`}
        >
          {item.aligned ? "Aligned" : "Diverged"}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
        <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
          {getIssueTagLabel(item.issueSlug)}
        </span>
        <span
          className={`rounded px-2 py-0.5 ${
            item.userStance === "support"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          You {item.userStance}
        </span>
        <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
          Rep: {item.vote}
        </span>
        <span>{new Date(item.votedAt).toLocaleDateString()}</span>
      </div>

      {summary ? (
        <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">
          <p className={expanded ? undefined : "line-clamp-3"}>{summary}</p>
          {showToggle && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-slate-600 underline dark:text-slate-400"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      ) : item.voteContext ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{item.voteContext}</p>
      ) : null}

      {billTextUrl && (
        <p className="mt-3">
          <a
            href={billTextUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-slate-600 underline hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            View full bill text on Congress.gov
          </a>
        </p>
      )}
    </li>
  );
}

export function ReflectionEvidence({ votes }: ReflectionEvidenceProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "aligned") return votes.filter((v) => v.aligned);
    if (filter === "diverged") return votes.filter((v) => !v.aligned);
    return votes;
  }, [votes, filter]);

  if (votes.length === 0) return null;

  return (
    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-medium text-slate-700 underline dark:text-slate-300"
      >
        {open ? "Hide" : "Show"} {votes.length} bills used in this score
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2 text-xs">
            {(["all", "aligned", "diverged"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-2.5 py-1 capitalize ${
                  filter === f
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <ul className="space-y-3">
            {filtered.map((item) => (
              <VoteEvidenceCard key={item.voteId} item={item} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
