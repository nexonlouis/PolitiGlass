"use client";

import { useMemo, useState } from "react";
import { getIssueTagLabel } from "@/lib/constants/issue-tags";
import { congressGovBillTextUrl } from "@/lib/legislation/bill-congress-url";
import { dedupeVotesByBill } from "@/lib/legislation/dedupe-votes-by-bill";
import {
  alignedFromUserSupports,
  effectiveStanceFromAlignment,
} from "@/lib/reflection/alignment-ui";
import type { VoteAlignmentItem } from "@/lib/types";
import type { IssueStance } from "@/lib/types/issue-tags";

type Filter = "all" | "aligned" | "diverged";

interface ReflectionEvidenceProps {
  votes: VoteAlignmentItem[];
  bioguideId: string;
  signedIn: boolean;
  onAlignmentChange: () => void | Promise<void>;
}

interface VoteEvidenceCardProps {
  item: VoteAlignmentItem;
  bioguideId: string;
  signedIn: boolean;
  onAlignmentChange: () => void | Promise<void>;
}

function effectiveStance(item: VoteAlignmentItem): IssueStance {
  if (item.alignmentSource === "manual") {
    return effectiveStanceFromAlignment(item.aligned, item.vote);
  }
  return item.userStance;
}

function VoteEvidenceCard({
  item,
  bioguideId,
  signedIn,
  onAlignmentChange,
}: VoteEvidenceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const summary = item.summary?.trim();
  const showToggle = summary && summary.length > 220;
  const billTextUrl = congressGovBillTextUrl(item.billId);
  const stance = effectiveStance(item);

  const toggleStance = async () => {
    if (!signedIn || saving) return;
    if (item.vote !== "Yea" && item.vote !== "Nay") return;

    const newStance: IssueStance = stance === "support" ? "oppose" : "support";
    const newAligned = alignedFromUserSupports(newStance === "support", item.vote);
    const revertToAuto = newAligned === item.autoAligned;

    setSaving(true);
    try {
      const response = await fetch(
        revertToAuto
          ? `/api/reflection-overrides?bioguideId=${encodeURIComponent(bioguideId)}&billId=${encodeURIComponent(item.billId)}`
          : "/api/reflection-overrides",
        {
          method: revertToAuto ? "DELETE" : "PUT",
          headers: revertToAuto ? undefined : { "Content-Type": "application/json" },
          body: revertToAuto
            ? undefined
            : JSON.stringify({
                bioguideId,
                billId: item.billId,
                aligned: newAligned,
              }),
        },
      );

      if (!response.ok) throw new Error("Could not save preference");
      await onAlignmentChange();
    } catch {
      // Keep card state unchanged on failure.
    } finally {
      setSaving(false);
    }
  };

  const alignmentBadgeClass = item.aligned
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
    : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300";

  const stanceBaseClass =
    stance === "support"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-300";
  const stanceHoverClass =
    stance === "support"
      ? "cursor-pointer transition-colors hover:bg-emerald-100 hover:ring-1 hover:ring-emerald-400/60 dark:hover:bg-emerald-900/60 dark:hover:ring-emerald-500/50"
      : "cursor-pointer transition-colors hover:bg-amber-100 hover:ring-1 hover:ring-amber-400/60 dark:hover:bg-amber-900/60 dark:hover:ring-amber-500/50";
  const manualStanceClass =
    item.alignmentSource === "manual"
      ? "ring-2 ring-slate-400 ring-offset-1 dark:ring-slate-500"
      : "";

  const stanceControl = signedIn ? (
    <button
      type="button"
      onClick={toggleStance}
      disabled={saving}
      title="Tap to change whether you support or oppose this bill"
      className={`rounded px-2 py-0.5 ${stanceBaseClass} ${manualStanceClass} ${saving ? "cursor-not-allowed opacity-50" : stanceHoverClass}`}
    >
      You {stance}
      {item.alignmentSource === "manual" ? " · yours" : ""}
    </button>
  ) : (
    <span className={`rounded px-2 py-0.5 ${stanceBaseClass}`}>You {stance}</span>
  );

  return (
    <li className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium text-slate-900 dark:text-slate-100">{item.title}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${alignmentBadgeClass}`}
        >
          {item.aligned ? "Aligned" : "Diverged"}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
        <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
          {getIssueTagLabel(item.issueSlug)}
        </span>
        {stanceControl}
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

export function ReflectionEvidence({
  votes,
  bioguideId,
  signedIn,
  onAlignmentChange,
}: ReflectionEvidenceProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const uniqueVotes = useMemo(() => dedupeVotesByBill(votes), [votes]);

  const filtered = useMemo(() => {
    if (filter === "aligned") return uniqueVotes.filter((v) => v.aligned);
    if (filter === "diverged") return uniqueVotes.filter((v) => !v.aligned);
    return uniqueVotes;
  }, [uniqueVotes, filter]);

  if (uniqueVotes.length === 0) return null;

  return (
    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-medium text-slate-700 underline dark:text-slate-300"
      >
        {open ? "Hide" : "Show"} {uniqueVotes.length} bills used in this score
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {signedIn && (
            <p className="text-xs text-slate-500">
              Tap You support or You oppose if your view on a bill differs from your
              issue tags. Aligned and Diverged update from how your representative
              voted.
            </p>
          )}
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
              <VoteEvidenceCard
                key={item.billId}
                item={item}
                bioguideId={bioguideId}
                signedIn={signedIn}
                onAlignmentChange={onAlignmentChange}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
