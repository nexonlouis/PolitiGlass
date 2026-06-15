import Link from "next/link";
import { DistrictForum } from "@/components/forum/DistrictForum";

export const metadata = {
  title: "Community forum · PolitiGlass",
};

export default function ForumPage() {
  return (
    <main className="mx-auto min-h-full max-w-2xl flex-1 px-4 py-10">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
        ← Dashboard
      </Link>
      <div className="mt-6">
        <DistrictForum />
      </div>
    </main>
  );
}
