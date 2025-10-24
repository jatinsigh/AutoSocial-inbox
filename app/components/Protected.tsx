"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function Protected({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const sb = supabaseBrowser();

    // initial check
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setReady(true);
    });

    // react to changes (logout elsewhere, etc.)
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) return <div style={{ padding: 20 }}>Checking session…</div>;
  return <>{children}</>;
}
