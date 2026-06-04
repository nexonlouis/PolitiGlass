import type { DemographicsInput, DistrictLookupResult } from "@/lib/types";

const KEY = "civicmirror_onboarding";

export interface OnboardingDraft {
  lookup: DistrictLookupResult | null;
  demographics: DemographicsInput;
  tags: string[];
  tagWeights: Record<string, number>;
}

const empty: OnboardingDraft = {
  lookup: null,
  demographics: {},
  tags: [],
  tagWeights: {},
};

export function loadOnboardingDraft(): OnboardingDraft {
  if (typeof window === "undefined") return empty;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return empty;
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return empty;
  }
}

export function saveOnboardingDraft(draft: Partial<OnboardingDraft>) {
  const current = loadOnboardingDraft();
  const next = { ...current, ...draft };
  sessionStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearOnboardingDraft() {
  sessionStorage.removeItem(KEY);
}
