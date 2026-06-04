"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { RepresentativeCard } from "@/components/representatives/RepresentativeCard";
import {
  EDUCATION_LEVELS,
  INCOME_BRACKETS,
  ISSUE_TAGS,
} from "@/lib/constants/issue-tags";
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from "@/lib/onboarding/storage";
import type { DistrictLookupResult, DemographicsInput } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

const STEPS = ["location", "demographics", "tags", "reveal"] as const;
type Step = (typeof STEPS)[number];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("location");
  const [address, setAddress] = useState("");
  const [lookup, setLookup] = useState<DistrictLookupResult | null>(null);
  const [demographics, setDemographics] = useState<DemographicsInput>({});
  const [suggestedSlugs, setSuggestedSlugs] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const draft = loadOnboardingDraft();
    if (draft.lookup) setLookup(draft.lookup);
    if (draft.demographics) setDemographics(draft.demographics);
    if (draft.tags.length) setSelectedTags(draft.tags);
  }, []);

  const stepIndex = STEPS.indexOf(step);

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

      const slugs = (data.suggested as { slug: string }[]).map((s) => s.slug);
      setSuggestedSlugs(slugs);
      const preselect = slugs.slice(0, 5);
      setSelectedTags(preselect);
      saveOnboardingDraft({ demographics, tags: preselect });
      setStep("tags");
    } catch {
      setError("Could not load issue suggestions");
    } finally {
      setLoading(false);
    }
  }, [demographics]);

  const toggleTag = (slug: string) => {
    setSelectedTags((prev) => {
      const next = prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length < 8
          ? [...prev, slug]
          : prev;
      saveOnboardingDraft({ tags: next });
      return next;
    });
  };

  const finishOnboarding = async () => {
    if (!lookup || selectedTags.length < 3) {
      setError("Select at least 3 issue priorities.");
      return;
    }

    saveOnboardingDraft({ tags: selectedTags, demographics });
    setStep("reveal");
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const tagWeights: Record<string, number> = {};
      selectedTags.forEach((t) => {
        tagWeights[t] = 3;
      });

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
          tags: selectedTags,
          weights: tagWeights,
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
            Enter your address to locate the officials representing you. We store
            your district, not your full street address, when you create an account.
          </p>
          <div className="mt-4 space-y-3">
            <Input
              placeholder="123 Main St, City, ST 12345"
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
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Choose 3–8 issues. {suggestedSlugs.length > 0 && "Suggested tags are highlighted."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {ISSUE_TAGS.map((tag) => {
              const selected = selectedTags.includes(tag.slug);
              const suggested = suggestedSlugs.includes(tag.slug);
              return (
                <button
                  key={tag.slug}
                  type="button"
                  onClick={() => toggleTag(tag.slug)}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    selected
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : suggested
                        ? "border-2 border-slate-900 bg-slate-50 dark:border-slate-100"
                        : "border border-slate-300 bg-white dark:border-slate-600"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">{selectedTags.length} selected</p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => setStep("demographics")}>
              Back
            </Button>
            <Button
              onClick={finishOnboarding}
              disabled={loading || selectedTags.length < 3}
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
