"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RepresentativeCard } from "@/components/representatives/RepresentativeCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadOnboardingDraft } from "@/lib/onboarding/storage";
import type { ReflectionScoreResult, Representative } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

export function DashboardView() {
  const [reps, setReps] = useState<Representative[]>([]);
  const [district, setDistrict] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [reflection, setReflection] = useState<ReflectionScoreResult | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    async function load() {
      const draft = loadOnboardingDraft();
      let loadedReps: Representative[] = draft.lookup?.representatives ?? [];
      let loadedDistrict = draft.lookup?.congressionalDistrict ?? null;
      let loadedTags = draft.tags;

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
            .select("saved_issue_tags")
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
            loadedTags = demo.saved_issue_tags;
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
      setTags(loadedTags);
    }

    void load();
  }, []);

  useEffect(() => {
    const houseRep = reps.find((r) => r.chamber === "house");
    if (!houseRep || tags.length === 0) return;

    const params = new URLSearchParams({
      bioguideId: houseRep.bioguideId,
      tags: tags.join(","),
    });

    fetch(`/api/reflection-score?${params}`)
      .then((r) => r.json())
      .then((data) => setReflection(data as ReflectionScoreResult))
      .catch(() => undefined);
  }, [reps, tags]);

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
                  House votes for {houseRep.fullName}. Senate scoring requires LegiScan
                  or CIV.IQ integration.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Add a Congress.gov API key for live House roll-call alignment, or continue
              in demo mode to explore the UI.
            </p>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Priority issues</h2>
        {tags.length === 0 ? (
          <p className="text-sm text-slate-600">No issues selected yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((slug) => (
              <span
                key={slug}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm dark:bg-slate-800"
              >
                {slug.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">District forum</h2>
        <Card>
          <p className="text-sm text-slate-600">
            Discussion board schema and RLS are ready. Post UI is next — your district
            is {district ?? "not set"}.
          </p>
        </Card>
      </section>
    </div>
  );
}
