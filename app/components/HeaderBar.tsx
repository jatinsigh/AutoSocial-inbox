"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

export default function HeaderBar() {
  const [email, setEmail] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email || ""));
  }, []);

  async function logout() {
    const sb = supabaseBrowser();
    await sb.auth.signOut();
    setEmail("");
    router.replace("/login");
  }

  return (
    <header className="header">
      <div className="container header-row">
        <a className="brand" href="/">AutoSocial</a>

        <button
          aria-label="Menu"
          className="hamburger"
          onClick={() => setMenuOpen((v) => !v)}
        >
          ☰
        </button>

        <nav className={`nav ${menuOpen ? "open" : ""}`}>
          <a href="/">Home</a>
          <a href="/inbox">Inbox</a>
          <a href="/settings">Settings</a>
          {email ? (
            <>
              <span className="user-badge" title={email}>
                {email.split("@")[0]}
              </span>
              <button className="btn ghost" onClick={logout}>Logout</button>
            </>
          ) : (
            <a className="btn" href="/login">Login</a>
          )}
        </nav>
      </div>
    </header>
  );
}
