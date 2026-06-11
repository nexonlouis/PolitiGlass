"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const linkClass =
  "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200";

export function SiteNav() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setSignedIn(!!user);
      if (!user) {
        setUsername(null);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();
      setUsername(profile?.username ?? null);
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setSignedIn(false);
    setUsername(null);
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href="/onboarding" className={linkClass}>
        Onboarding
      </Link>
      <Link href="/dashboard" className={linkClass}>
        Dashboard
      </Link>
      <Link href="/forum" className={linkClass}>
        Forum
      </Link>
      {signedIn ? (
        <>
          {username && (
            <span className="hidden text-slate-500 sm:inline dark:text-slate-400">
              {username}
            </span>
          )}
          <button type="button" onClick={signOut} className={linkClass}>
            Sign out
          </button>
        </>
      ) : (
        <Link href="/auth" className={linkClass}>
          Sign in
        </Link>
      )}
    </div>
  );
}
