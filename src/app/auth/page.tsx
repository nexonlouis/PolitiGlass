"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLogo } from "@/components/layout/AppLogo";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { loadOnboardingDraft } from "@/lib/onboarding/storage";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const completePendingOnboarding = async () => {
    const draft = loadOnboardingDraft();
    if (!draft.lookup || draft.tagPreferences.length < 3) return;

    const tags = draft.tagPreferences.map((p) => p.slug);

    await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        congressionalDistrict: draft.lookup.congressionalDistrict,
        state: draft.lookup.state,
        ocdDivisionId: draft.lookup.ocdDivisionId,
        lookupZip: draft.lookup.lookupZip,
        representatives: draft.lookup.representatives,
        demographics: draft.demographics,
        tags,
        tagPreferences: draft.tagPreferences,
      }),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
    }

    await completePendingOnboarding();
    router.push(next);
    router.refresh();
  };

  return (
    <Card>
      <h1 className="text-2xl font-bold">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Save your calibration and sync across devices.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block text-sm">
          Email
          <Input
            type="email"
            required
            className="mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Password
          <Input
            type="password"
            required
            minLength={8}
            className="mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Please wait…" : mode === "signup" ? "Sign up" : "Sign in"}
        </Button>
      </form>
      <button
        type="button"
        className="mt-4 text-sm text-slate-600 underline dark:text-slate-400"
        onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
      >
        {mode === "signup"
          ? "Already have an account? Sign in"
          : "Need an account? Sign up"}
      </button>
    </Card>
  );
}

export default function AuthPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <AppLogo size="sm" className="mb-6 text-slate-500 [&_span]:font-normal [&_span]:text-slate-500 hover:[&_span]:text-slate-800 dark:hover:[&_span]:text-slate-200" />
      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <AuthForm />
      </Suspense>
    </main>
  );
}
