import { ProfileEditor } from "@/components/profile/ProfileEditor";
import Link from "next/link";

export const metadata = {
  title: "Profile · PolitiGlass",
};

export default function ProfilePage() {
  return (
    <main className="mx-auto min-h-full max-w-lg flex-1 px-4 py-10">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
        ← Dashboard
      </Link>
      <div className="mt-6">
        <ProfileEditor />
      </div>
    </main>
  );
}
