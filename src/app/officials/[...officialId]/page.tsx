import Link from "next/link";
import { notFound } from "next/navigation";
import { OfficialProfileView } from "@/components/officials/OfficialProfileView";
import { fetchOfficialProfile } from "@/lib/officials/fetch-official-profile";
import { officialIdFromSegments } from "@/lib/officials/profile-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ officialId: string[] }>;
}) {
  const { officialId } = await params;
  const id = officialIdFromSegments(officialId);
  const profile = await fetchOfficialProfile(id);

  return {
    title: profile ? `${profile.fullName} · PolitiGlass` : "Official · PolitiGlass",
  };
}

export default async function OfficialProfilePage({
  params,
}: {
  params: Promise<{ officialId: string[] }>;
}) {
  const { officialId } = await params;
  const id = officialIdFromSegments(officialId);
  const profile = await fetchOfficialProfile(id);

  if (!profile) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-full max-w-3xl flex-1 px-4 py-10">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
        ← Dashboard
      </Link>
      <div className="mt-6">
        <OfficialProfileView profile={profile} />
      </div>
    </main>
  );
}
