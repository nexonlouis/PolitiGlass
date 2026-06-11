"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { RepresentativeCard } from "@/components/representatives/RepresentativeCard";
import { IssueTagPicker } from "@/components/onboarding/IssueTagPicker";
import {
  EDUCATION_LEVELS,
  INCOME_BRACKETS,
  type IssueTagDefinition,
} from "@/lib/constants/issue-tags";
import { sortTagsForDisplay, getTopSuggestedSlugs } from "@/lib/constants/issue-tag-graph";
import { rankTagsByDemographics } from "@/lib/demographics/suggest-tags";
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from "@/lib/onboarding/storage";
import type { DistrictLookupResult, DemographicsInput } from "@/lib/types";
import type { IssueTagPreference } from "@/lib/types/issue-tags";
import { createClient } from "@/lib/supabase/client";

const STEPS = ["location", "demographics", "tags", "reveal"] as const;
type Step = (typeof STEPS)[number];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("location");
  const [address, setAddress] = useState("");
  const [lookup, setLookup] = useState<DistrictLookupResult | null>(null);
  const [lookupSource, setLookupSource] = useState<string | null>(null);
  const [demographics, setDemographics] = useState<DemographicsInput>({});
  const [displayTags, setDisplayTags] = useState<IssueTagDefinition[]>([]);
  const [suggestedSlugs, setSuggestedSlugs] = useState<string[]>([]);
  const [tagPreferences, setTagPreferences] = useState<IssueTagPreference[]>([]);
  const [anchorSlug, setAnchorSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const draft = loadOnboardingDraft();
    if (draft.lookup) setLookup(draft.lookup);
    if (draft.demographics) setDemographics(draft.demographics);
    if (draft.tagPreferences.length) {
      setTagPreferences(draft.tagPreferences);
    }
  }, []);

  const stepIndex = STEPS.indexOf(step);

  const persistPreferences = useCallback((next: IssueTagPreference[]) => {
    setTagPreferences(next);
    saveOnboardingDraft({ tagPreferences: next });
  }, []);

  const runLookup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lookup-representatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");

      const result: DistrictLookupResult = {
        congressionalDistrict: data.congressionalDistrict,
        state: data.state,
        ocdDivisionId: data.ocdDivisionId,
        lookupZip: data.lookupZip,
        representatives: data.representatives,
        source: data.source,
      };
      setLookup(result);
      setLookupSource(data.source ?? null);
      saveOnboardingDraft({ lookup: result });
      setStep("demographics");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }, [address]);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demographics),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Could not load suggestions");

      const scores = rankTagsByDemographics(demographics);
      const sorted = sortTagsForDisplay(scores);
      setDisplayTags(sorted);
      setSuggestedSlugs(getTopSuggestedSlugs(scores));

      const preselect: IssueTagPreference[] = (data.suggested as { slug: string }[])
        .slice(0, 5)
        .map((s) => ({ slug: s.slug, weight: 3, stance: "support" as const }));

      setTagPreferences(preselect);
      setAnchorSlug(preselect[0]?.slug ?? null);
      saveOnboardingDraft({ demographics, tagPreferences: preselect });
      setStep("tags");
    } catch {
      setError("Could not load issue suggestions");
    } finally {
      setLoading(false);
    }
  }, [demographics]);

  const finishOnboarding = async () => {
    if (!lookup || tagPreferences.length < 3) {
      setError("Select at least 3 issue priorities.");
      return;
    }

    saveOnboardingDraft({ tagPreferences, demographics });
    setStep("reveal");
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const tags = tagPreferences.map((p) => p.slug);

    if (user) {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          congressionalDistrict: lookup.congressionalDistrict,
          state: lookup.state,
          ocdDivisionId: lookup.ocdDivisionId,
          lookupZip: lookup.lookupZip,
          representatives: lookup.representatives,
          demographics,
          tags,
          tagPreferences,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not save profile");
        setLoading(false);
        return;
      }

      clearOnboardingDraft();
      router.push("/dashboard");
      return;
    }

    setLoading(false);
    router.push("/auth?next=/dashboard");
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${i <= stepIndex ? "bg-slate-900 dark:bg-slate-100" : "bg-slate-200 dark:bg-slate-700"}`}
          />
        ))}
      </div>

      {step === "location" && (
        <Card>
          <h2 className="text-xl font-semibold">Clear the fog</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Enter your full US address (street, city, ST zip) to locate your
            officials from live government data. We store your district, not your
            street address, when you create an account.
          </p>
          <div className="mt-4 space-y-3">
            <Input
              placeholder="440 Burroughs St, Detroit, MI 48202"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={runLookup} disabled={loading || address.length < 5}>
              {loading ? "Locating…" : "Find my officials"}
            </Button>
          </div>
        </Card>
      )}

      {step === "demographics" && lookup && (
        <Card>
          <p className="mb-3 text-xs text-emerald-700 dark:text-emerald-400">
            Found {lookup.representatives.length} officials in district{" "}
            {lookup.congressionalDistrict}
            {lookupSource && lookupSource !== "demo"
              ? ` · Live data (${lookupSource})`
              : ""}
          </p>
          <h2 className="text-xl font-semibold">Calibrate your reflection</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Optional details help suggest issues you may care about. Skip any field
            you prefer not to answer.
          </p>
          <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Stored in your private account when you sign in — never shown on
            discussion boards.
          </p>
          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              Birth year
              <Input
                type="number"
                className="mt-1"
                placeholder="1990"
                value={demographics.birthYear ?? ""}
                onChange={(e) =>
                  setDemographics((d) => ({
                    ...d,
                    birthYear: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </label>
            <label className="block text-sm">
              Education
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                value={demographics.educationLevel ?? ""}
                onChange={(e) =>
                  setDemographics((d) => ({ ...d, educationLevel: e.target.value }))
                }
              >
                <option value="">Prefer not to say</option>
                {EDUCATION_LEVELS.map((v) => (
                  <option key={v} value={v}>
                    {v.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Income bracket
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                value={demographics.incomeBracket ?? ""}
                onChange={(e) =>
                  setDemographics((d) => ({ ...d, incomeBracket: e.target.value }))
                }
              >
                <option value="">Prefer not to say</option>
                {INCOME_BRACKETS.map((v) => (
                  <option key={v} value={v}>
                    {v.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={demographics.hasChildren === true}
                onChange={(e) =>
                  setDemographics((d) => ({ ...d, hasChildren: e.target.checked }))
                }
              />
              I have children under 18
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep("location")}>
                Back
              </Button>
              <Button onClick={loadSuggestions} disabled={loading}>
                {loading ? "Loading…" : "Continue"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === "tags" && (
        <Card>
          <h2 className="text-xl font-semibold">Your first reflection</h2>
          <div className="mt-4">
            <IssueTagPicker
              displayTags={
                displayTags.length > 0
                  ? displayTags
                  : sortTagsForDisplay(rankTagsByDemographics(demographics))
              }
              suggestedSlugs={suggestedSlugs}
              preferences={tagPreferences}
              anchorSlug={anchorSlug}
              onPreferencesChange={persistPreferences}
              onAnchorChange={setAnchorSlug}
            />
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => setStep("demographics")}>
              Back
            </Button>
            <Button
              onClick={finishOnboarding}
              disabled={loading || tagPreferences.length < 3}
            >
              {loading ? "Saving…" : "See my dashboard"}
            </Button>
          </div>
        </Card>
      )}

      {step === "reveal" && lookup && (
        <Card className="animate-in fade-in">
          <h2 className="text-xl font-semibold">Step through the glass</h2>
          <p className="mt-2 text-sm text-slate-600">
            District {lookup.congressionalDistrict} · {lookup.state}
          </p>
          <div className="mt-4 space-y-3">
            {lookup.representatives.map((rep) => (
              <RepresentativeCard key={rep.bioguideId} rep={rep} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
