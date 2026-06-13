"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ReflectionEvidence } from "@/components/dashboard/ReflectionEvidence";
import { Card } from "@/components/ui/card";
import type { ReflectionScoreResult, Representative } from "@/lib/types";
import type { IssueTagPreference } from "@/lib/types/issue-tags";

function buildReflectionParams(
  bioguideId: string,
  preferences: IssueTagPreference[],
): URLSearchParams {
  const params = new URLSearchParams({
    bioguideId,
    tags: preferences.map((p) => p.slug).join(","),
    includeVotes: "1",
  });

  for (const pref of preferences) {
    params.set(`weight_${pref.slug}`, String(pref.weight));
    params.set(`stance_${pref.slug}`, pref.stance);
  }

  return params;
}

function sortFederalReps(reps: Representative[]): Representative[] {
  const chamberOrder = { house: 0, senate: 1, state: 2 };
  return reps
    .filter((r) => r.chamber === "house" || r.chamber === "senate")
    .sort(
      (a, b) =>
        chamberOrder[a.chamber] - chamberOrder[b.chamber] ||
        a.fullName.localeCompare(b.fullName),
    );
}

function officialTabLabel(rep: Representative): string {
  if (rep.chamber === "house") {
    return rep.district ? `House · ${rep.district}` : "House";
  }

  const parts = rep.fullName.trim().split(/\s+/);
  const lastName = parts[parts.length - 1] ?? rep.fullName;
  return `Sen. ${lastName}`;
}

function chamberLabel(rep: Representative): string {
  if (rep.chamber === "house") return "U.S. Representative";
  if (rep.chamber === "senate") return "U.S. Senator";
  return "Official";
}

interface OfficialReflectionTabsProps {
  reps: Representative[];
  preferences: IssueTagPreference[];
  signedIn: boolean;
}

export function OfficialReflectionTabs({
  reps,
  preferences,
  signedIn,
}: OfficialReflectionTabsProps) {
  const federalReps = useMemo(() => sortFederalReps(reps), [reps]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reflections, setReflections] = useState<
    Record<string, ReflectionScoreResult>
  >({});
  const [loading, setLoading] = useState(false);

  const loadReflections = useCallback(async () => {
    if (federalReps.length === 0 || preferences.length === 0) {
      setReflections({});
      setActiveId(null);
      return;
    }

    setLoading(true);

    try {
      const entries = await Promise.all(
        federalReps.map(async (rep) => {
          const params = buildReflectionParams(rep.bioguideId, preferences);
          const response = await fetch(`/api/reflection-score?${params}`);
          const data = (await response.json()) as ReflectionScoreResult;
          return [rep.bioguideId, data] as const;
        }),
      );

      const next = Object.fromEntries(entries);
      setReflections(next);
      setActiveId((prev) => {
        if (prev && next[prev]) return prev;
        return federalReps[0]?.bioguideId ?? null;
      });
    } catch {
      setReflections({});
    } finally {
      setLoading(false);
    }
  }, [federalReps, preferences]);

  useEffect(() => {
    void loadReflections();
  }, [loadReflections]);

  const activeRep = federalReps.find((r) => r.bioguideId === activeId) ?? null;
  const reflection = activeId ? reflections[activeId] : undefined;

  if (federalReps.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          Complete onboarding to see reflection scores for your representatives.
        </p>
      </Card>
    );
  }

  if (preferences.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          Select priority issues during onboarding to calculate reflection scores.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div
        role="tablist"
        aria-label="Official reflection scores"
        className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900/50"
      >
        {federalReps.map((rep) => {
          const selected = rep.bioguideId === activeId;
          const score = reflections[rep.bioguideId]?.score;

          return (
            <button
              key={rep.bioguideId}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(rep.bioguideId)}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm transition-colors ${
                selected
                  ? "bg-white font-medium text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-600 hover:bg-white/70 dark:text-slate-400 dark:hover:bg-slate-800/60"
              }`}
            >
              <span>{officialTabLabel(rep)}</span>
              {score !== undefined && !loading && (
                <span className="ml-1.5 tabular-nums text-slate-500 dark:text-slate-400">
                  {score}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4" role="tabpanel">
        {loading && !reflection ? (
          <p className="text-sm text-slate-500">Loading reflection score…</p>
        ) : activeRep && reflection && reflection.votesAnalyzed > 0 ? (
          <>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {activeRep.fullName}
            </p>
            <p className="text-xs text-slate-500">{chamberLabel(activeRep)}</p>
            <p className="mt-3 text-4xl font-bold">{reflection.score}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {reflection.message}
            </p>
            <p className="mt-1 text-xs uppercase text-slate-500">
              Confidence: {reflection.confidence}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Scored from ingested roll-call votes for {activeRep.fullName}.
              {signedIn
                ? " Tap You support/oppose on a bill below to adjust your view after reading."
                : " Sign in to adjust your support or oppose on individual bills."}
            </p>
            {reflection.scoredVotes && reflection.scoredVotes.length > 0 && activeId && (
              <ReflectionEvidence
                votes={reflection.scoredVotes}
                bioguideId={activeId}
                signedIn={signedIn}
                onAlignmentChange={loadReflections}
              />
            )}
          </>
        ) : activeRep ? (
          <>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {activeRep.fullName}
            </p>
            <p className="mt-1 text-xs text-slate-500">{chamberLabel(activeRep)}</p>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              No scored roll-call votes yet for {activeRep.fullName} on your priority
              issues. Run the congress vote ingest or check that Senate roll calls are
              loaded for this member.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            Select an official to view their reflection score.
          </p>
        )}
      </div>
    </Card>
  );
}
