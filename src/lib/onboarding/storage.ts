import type { DemographicsInput, DistrictLookupResult } from "@/lib/types";
import type { IssueTagPreference } from "@/lib/types/issue-tags";

const KEY = "civicmirror_onboarding";

export interface OnboardingDraft {
  lookup: DistrictLookupResult | null;
  demographics: DemographicsInput;
  /** @deprecated use tagPreferences */
  tags: string[];
  tagWeights: Record<string, number>;
  tagPreferences: IssueTagPreference[];
}

const empty: OnboardingDraft = {
  lookup: null,
  demographics: {},
  tags: [],
  tagWeights: {},
  tagPreferences: [],
};

function normalizeDraft(parsed: Partial<OnboardingDraft>): OnboardingDraft {
  const merged = { ...empty, ...parsed };

  if (merged.tagPreferences.length === 0 && merged.tags.length > 0) {
    merged.tagPreferences = merged.tags.map((slug) => ({
      slug,
      weight: merged.tagWeights[slug] ?? 3,
      stance: "support" as const,
    }));
  }

  merged.tags = merged.tagPreferences.map((p) => p.slug);
  merged.tagWeights = Object.fromEntries(
    merged.tagPreferences.map((p) => [p.slug, p.weight]),
  );

  return merged;
}

export function loadOnboardingDraft(): OnboardingDraft {
  if (typeof window === "undefined") return empty;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return empty;
    return normalizeDraft(JSON.parse(raw));
  } catch {
    return empty;
  }
}

export function saveOnboardingDraft(draft: Partial<OnboardingDraft>) {
  const current = loadOnboardingDraft();
  const next = normalizeDraft({ ...current, ...draft });
  sessionStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearOnboardingDraft() {
  sessionStorage.removeItem(KEY);
}
