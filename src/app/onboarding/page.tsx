import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata = {
  title: "Calibrate · CivicMirror",
};

export default function OnboardingPage() {
  return (
    <main className="mx-auto min-h-full max-w-3xl flex-1 px-4 py-10">
      <p className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">
        Onboarding
      </p>
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Calibrate your mirror</h1>
      <OnboardingWizard />
    </main>
  );
}
