"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IssueTagPicker } from "@/components/onboarding/IssueTagPicker";
import { DemographicsFields } from "@/components/profile/DemographicsFields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { IssueTagDefinition } from "@/lib/constants/issue-tags";
import { sortTagsForDisplay, getTopSuggestedSlugs } from "@/lib/constants/issue-tag-graph";
import { rankTagsByDemographics } from "@/lib/demographics/suggest-tags";
import { notifyProfileUpdated } from "@/lib/profile/events";
import type { DemographicsInput } from "@/lib/types";
import type { IssueTagPreference } from "@/lib/types/issue-tags";

export function ProfileEditor() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [username, setUsername] = useState("");
  const [district, setDistrict] = useState<string | null>(null);
  const [demographics, setDemographics] = useState<DemographicsInput>({});
  const [tagPreferences, setTagPreferences] = useState<IssueTagPreference[]>([]);
  const [anchorSlug, setAnchorSlug] = useState<string | null>(null);
  const [displayTags, setDisplayTags] = useState<IssueTagDefinition[]>([]);
  const [suggestedSlugs, setSuggestedSlugs] = useState<string[]>([]);

  const refreshTagDisplay = useCallback((demo: DemographicsInput) => {
    const scores = rankTagsByDemographics(demo);
    setDisplayTags(sortTagsForDisplay(scores));
    setSuggestedSlugs(getTopSuggestedSlugs(scores));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/profile");
        const data = await res.json();
        if (res.status === 401) {
          router.push("/auth?next=/profile");
          return;
        }
        if (!res.ok) throw new Error(data.error ?? "Could not load profile");

        setUsername(data.username ?? "");
        setDistrict(data.congressionalDistrict ?? null);
        setDemographics(data.demographics ?? {});
        setTagPreferences(data.tagPreferences ?? []);
        setAnchorSlug(data.tagPreferences?.[0]?.slug ?? null);
        refreshTagDisplay(data.demographics ?? {});
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load profile");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [router, refreshTagDisplay]);

  const refreshSuggestions = async () => {
    setError(null);
    try {
      const res = await fetch("/api/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demographics),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Could not refresh suggestions");
      refreshTagDisplay(demographics);
      setSuggestedSlugs(
        (data.suggested as { slug: string }[]).map((s) => s.slug).slice(0, 8),
      );
    } catch {
      setError("Could not refresh issue suggestions");
    }
  };

  const save = async () => {
    if (tagPreferences.length < 3) {
      setError("Select at least 3 issue priorities.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, demographics, tagPreferences }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : "Could not save profile";
        throw new Error(message);
      }
      setSuccess(true);
      notifyProfileUpdated({ username });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading profile…</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Update your forum username, private demographics, and issue priorities.
          {district && district !== "unassigned" && (
            <> District {district} is set from onboarding.</>
          )}
        </p>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Profile saved. Your dashboard reflection score will use your updated
          priorities.
        </p>
      )}

      <Card>
        <h2 className="text-lg font-semibold">Forum username</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Shown on district forum posts and comments.
        </p>
        <label className="mt-4 block text-sm">
          Username
          <Input
            className="mt-1"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]+"
          />
        </label>
        <p className="mt-1 text-xs text-slate-500">
          Letters, numbers, and underscores only (3–30 characters).
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Demographics</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Private — used only to suggest issues. Never shown on the forum.
        </p>
        <div className="mt-4">
          <DemographicsFields value={demographics} onChange={setDemographics} />
        </div>
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={refreshSuggestions}
        >
          Refresh issue suggestions
        </Button>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Priority issues</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Choose 3–8 issues and whether you support or oppose each. These drive
          your reflection score.
        </p>
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
            onPreferencesChange={setTagPreferences}
            onAnchorChange={setAnchorSlug}
          />
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={save} disabled={saving || tagPreferences.length < 3}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
        <Link href="/dashboard">
          <Button type="button" variant="secondary">
            Back to dashboard
          </Button>
        </Link>
        {(!district || district === "unassigned") && (
          <Link href="/onboarding">
            <Button type="button" variant="ghost">
              Complete address onboarding
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
