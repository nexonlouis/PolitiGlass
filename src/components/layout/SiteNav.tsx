"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PROFILE_UPDATED_EVENT } from "@/lib/profile/events";
import { createClient } from "@/lib/supabase/client";

const linkClass =
  "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200";

export function SiteNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    const supabase = createClient();
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
  }, []);

  useEffect(() => {
    void loadUser();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadUser();
    });

    return () => subscription.unsubscribe();
  }, [loadUser, pathname]);

  useEffect(() => {
    const onProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ username?: string }>).detail;
      if (detail?.username) {
        setUsername(detail.username);
        return;
      }
      void loadUser();
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
  }, [loadUser]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setSignedIn(false);
    setUsername(null);
    router.push("/");
    router.refresh();
  };

  const profileLabel = username ? `Profile[${username}]` : "Profile";

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
          <Link href="/profile" className={linkClass}>
            {profileLabel}
          </Link>
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
