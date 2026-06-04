import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-full max-w-4xl flex-1 flex-col justify-center px-4 py-16">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-10 dark:border-slate-700 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full border border-slate-300/60 dark:border-slate-600/40"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 rounded-full border border-slate-400/40 dark:border-slate-500/30"
          aria-hidden
        />
        <p className="text-sm font-medium uppercase tracking-widest text-slate-500">
          CivicMirror
        </p>
        <h1 className="mt-3 max-w-xl text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          Break through the distortion. See who represents you clearly.
        </h1>
        <p className="mt-4 max-w-lg text-lg text-slate-600 dark:text-slate-400">
          Find your elected officials, track votes that match your priorities, and
          connect with neighbors in your congressional district.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/onboarding">
            <Button>Calibrate your mirror</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="secondary">View dashboard</Button>
          </Link>
        </div>
        <p className="mt-8 text-xs text-slate-500">
          Nonpartisan civic data · Your demographics stay private
        </p>
      </div>
    </main>
  );
}
