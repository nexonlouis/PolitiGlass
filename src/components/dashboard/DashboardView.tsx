"use client";

import { useEffect, useState } from "react";
import { RepresentativeCard } from "@/components/representatives/RepresentativeCard";
import { ReflectionEvidence } from "@/components/dashboard/ReflectionEvidence";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getIssueTagLabel } from "@/lib/constants/issue-tags";
import { parseIssueTagWeights } from "@/lib/legislation/issue-tag-preferences";
import { loadOnboardingDraft } from "@/lib/onboarding/storage";
import type { ReflectionScoreResult, Representative } from "@/lib/types";
import type { IssueTagPreference } from "@/lib/types/issue-tags";
import { createClient } from "@/lib/supabase/client";
import { DistrictForum } from "@/components/forum/DistrictForum";
import Link from "next/link";

export function DashboardView() {
  const [reps, setReps] = useState<Representative[]>([]);
  const [district, setDistrict] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<IssueTagPreference[]>([]);
  const [reflection, setReflection] = useState<ReflectionScoreResult | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    async function load() {
      const draft = loadOnboardingDraft();
      let loadedReps: Representative[] = draft.lookup?.representatives ?? [];
      let loadedDistrict = draft.lookup?.congressionalDistrict ?? null;
      let loadedPreferences = draft.tagPreferences;

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setSignedIn(!!user);

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("congressional_district")
            .eq("id", user.id)
            .single();

          const { data: demo } = await supabase
            .from("user_demographics")
            .select("saved_issue_tags, issue_tag_weights")
            .eq("user_id", user.id)
            .single();

          const { data: savedReps } = await supabase
            .from("saved_representatives")
            .select("*")
            .eq("user_id", user.id);

          if (profile?.congressional_district) {
            loadedDistrict = profile.congressional_district;
          }
          if (demo?.saved_issue_tags?.length) {
            loadedPreferences = parseIssueTagWeights(
              demo.saved_issue_tags,
              demo.issue_tag_weights,
            );
          }
          if (savedReps?.length) {
            loadedReps = savedReps.map((r) => ({
              bioguideId: r.bioguide_id,
              fullName: r.full_name,
              chamber: r.chamber as Representative["chamber"],
              party: r.party,
              photoUrl: r.photo_url,
              state: r.state,
              district: r.district,
            }));
          }
        }
      } catch {
        // Supabase not configured — session draft only
      }

      setReps(loadedReps);
      setDistrict(loadedDistrict);
      setPreferences(loadedPreferences);
    }

    void load();
  }, []);

  useEffect(() => {
    const houseRep = reps.find((r) => r.chamber === "house");
    if (!houseRep || preferences.length === 0) return;

    const params = new URLSearchParams({
      bioguideId: houseRep.bioguideId,
      tags: preferences.map((p) => p.slug).join(","),
      includeVotes: "1",
    });

    for (const pref of preferences) {
      params.set(`weight_${pref.slug}`, String(pref.weight));
      params.set(`stance_${pref.slug}`, pref.stance);
    }

    fetch(`/api/reflection-score?${params}`)
      .then((r) => r.json())
      .then((data) => setReflection(data as ReflectionScoreResult))
      .catch(() => undefined);
  }, [reps, preferences]);

  const houseRep = reps.find((r) => r.chamber === "house");

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-slate-500">Your reflection</p>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        {district && (
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Congressional district {district}
          </p>
        )}
      </header>

      {!signedIn && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            Sign in to save your profile and join district discussions.
          </p>
          <Link href="/auth?next=/dashboard" className="mt-3 inline-block">
            <Button variant="secondary">Sign in</Button>
          </Link>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your officials</h2>
        {reps.length === 0 ? (
          <p className="text-sm text-slate-600">
            Complete{" "}
            <Link href="/onboarding" className="underline">
              onboarding
            </Link>{" "}
            to see representatives.
          </p>
        ) : (
          <div className="space-y-3">
            {reps.map((rep) => (
              <RepresentativeCard key={rep.bioguideId} rep={rep} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Reflection score</h2>
        <Card>
          {reflection && reflection.votesAnalyzed > 0 ? (
            <>
              <p className="text-4xl font-bold">{reflection.score}</p>
              <p className="mt-1 text-sm text-slate-600">{reflection.message}</p>
              <p className="mt-1 text-xs uppercase text-slate-500">
                Confidence: {reflection.confidence}
              </p>
              {houseRep && (
                <p className="mt-2 text-xs text-slate-500">
                  Scored from ingested roll-call data for {houseRep.fullName} (House and
                  Senate when available).
                </p>
              )}
              {reflection.scoredVotes && reflection.scoredVotes.length > 0 && (
                <ReflectionEvidence votes={reflection.scoredVotes} />
              )}
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Complete onboarding and run congress vote ingest, or check that this
              official has roll-call records in the database.
            </p>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Priority issues</h2>
        {preferences.length === 0 ? (
          <p className="text-sm text-slate-600">No issues selected yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {preferences.map((pref) => (
              <span
                key={pref.slug}
                className={`rounded-full px-3 py-1 text-sm ${
                  pref.stance === "support"
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200"
                    : "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
                }`}
              >
                {getIssueTagLabel(pref.slug)} · {pref.stance}
              </span>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">District forum</h2>
          <Link href="/forum" className="text-sm text-slate-600 underline">
            Open full forum
          </Link>
        </div>
        <DistrictForum
          compact
          initialDistrict={district}
          initialIssueTags={preferences.map((p) => p.slug)}
        />
      </section>
    </div>
  );
}
