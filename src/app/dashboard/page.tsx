import { DashboardView } from "@/components/dashboard/DashboardView";
import Link from "next/link";

export const metadata = {
  title: "Dashboard · CivicMirror",
};

export default function DashboardPage() {
  return (
    <main className="mx-auto min-h-full max-w-3xl flex-1 px-4 py-10">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
        ← Home
      </Link>
      <div className="mt-6">
        <DashboardView />
      </div>
    </main>
  );
}
