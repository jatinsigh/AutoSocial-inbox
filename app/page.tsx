"use client";

import { useEffect, useMemo, useState } from "react";

type StatusResp = {
  env: {
    WA_TOKEN: boolean;
    WA_PHONE_ID: boolean;
    GRAPH_VERSION: boolean;
    RAZORPAY_KEY_ID: boolean;
    RAZORPAY_WEBHOOK_SECRET: boolean;
    SUPABASE_URL: boolean;
    SUPABASE_SERVICE_ROLE: boolean;
    NEXT_PUBLIC_APP_URL?: string | null;
  };
  wa_graph_ok?: boolean;
  wa_display_phone?: string | null;
  razorpay_auth_ok?: boolean;
  supabase_ok?: boolean;
  errors?: string[];
};

type Conv = { id: string; contact_id: string; status: string; updated_at: string };
type ContactMap = Record<string, { name: string | null }>;

export default function Home() {
  // Status
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Quick actions state (always visible now)
  const [to, setTo] = useState("");
  const [text, setText] = useState("Hello from AutoSocial 👋");
  const [tplName, setTplName] = useState("hello_world");
  const [tplLang, setTplLang] = useState("en_US");
  const [amount, setAmount] = useState<number>(49900);
  const [desc, setDesc] = useState("Event pass");
  const [actionMsg, setActionMsg] = useState("");

  // Recent conversations
  const [convs, setConvs] = useState<Conv[]>([]);
  const [contacts, setContacts] = useState<ContactMap>({});

  async function refreshStatus() {
    setLoadingStatus(true);
    try {
      const r = await fetch("/api/status", { cache: "no-store" }).then((r) => r.json());
      setStatus(r);
    } catch (e: any) {
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }

  async function loadConvs() {
    const r = await fetch("/api/inbox/conversations", { cache: "no-store" }).then((r) => r.json());
    setConvs(r.conversations || []);
    setContacts(r.contacts || {});
  }

  useEffect(() => {
    loadConvs();
    const t1 = setInterval(loadConvs, 7000);
    return () => clearInterval(t1);
  }, []);

  const warnList = useMemo(() => {
    if (!status?.env) return [];
    const e = status.env;
    const w: string[] = [];
    if (!e.WA_TOKEN) w.push("WA_TOKEN");
    if (!e.WA_PHONE_ID) w.push("WA_PHONE_ID");
    if (!e.GRAPH_VERSION) w.push("GRAPH_VERSION");
    if (!e.RAZORPAY_KEY_ID) w.push("RAZORPAY_KEY_ID");
    if (!e.RAZORPAY_WEBHOOK_SECRET) w.push("RAZORPAY_WEBHOOK_SECRET");
    if (!e.SUPABASE_URL) w.push("SUPABASE_URL");
    if (!e.SUPABASE_SERVICE_ROLE) w.push("SUPABASE_SERVICE_ROLE");
    return w;
  }, [status]);

  // --- Quick Actions handlers ---
  async function sendTemplate() {
    setActionMsg("");
    if (!to) return setActionMsg("Enter recipient (E.164 digits, no +).");
    try {
      const res = await fetch("/api/wa/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          kind: "template",
          template: { name: tplName, language: { code: tplLang } },
        }),
      }).then((r) => r.json());
      if (res?.error) setActionMsg(`Template send error: ${res.error}`);
      else setActionMsg(`Template sent.`);
    } catch (e: any) {
      setActionMsg(e?.message || "Template send failed");
    }
  }

  async function sendText() {
    setActionMsg("");
    if (!to) return setActionMsg("Enter recipient.");
    try {
      const res = await fetch("/api/wa/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, kind: "text", text }),
      }).then((r) => r.json());
      if (res?.error) setActionMsg(`Text send error: ${res.error}`);
      else setActionMsg(`Text sent.`);
    } catch (e: any) {
      setActionMsg(e?.message || "Text send failed");
    }
  }

  async function createLinkAndSend() {
    setActionMsg("");
    if (!to) return setActionMsg("Enter recipient.");
    if (!amount || amount < 100) return setActionMsg("Amount in paise (e.g., 49900 for ₹499).");
    try {
      const pl = await fetch("/api/payments/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, description: desc }),
      }).then((r) => r.json());
      if (!pl?.short_url) return setActionMsg(`Create link error: ${pl?.error || "unknown"}`);

      const wa = await fetch("/api/wa/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, kind: "text", text: `Here’s your payment link: ${pl.short_url}` }),
      }).then((r) => r.json());
      if (wa?.error) return setActionMsg(`Send link error: ${wa.error}`);
      setActionMsg(`Payment link sent.`);
    } catch (e: any) {
      setActionMsg(e?.message || "Failed to create/send payment link");
    }
  }

  return (
    <main className="container">
      {/* HERO (always visible) */}
      <section className="grid" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-body">
            <h1 className="card-title" style={{ fontSize: 22, marginBottom: 6 }}>
              Collect payments on WhatsApp
            </h1>
            <p className="muted" style={{ marginTop: 0 }}>
              AutoSocial connects WhatsApp Cloud API with Razorpay to send payment links, track status, and reply fast.
            </p>
            <div className="grid grid-2">
              <a className="btn ghost" href="/settings">
                Settings
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* STATUS (always visible) */}
      <section className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-body">
            <div className="card-title">System Status</div>
            <div className="grid grid-2">
              <Pill label="Supabase" ok={!!status?.supabase_ok} />
              <Pill label="WA Graph" ok={!!status?.wa_graph_ok} note={status?.wa_display_phone || undefined} />
              <Pill label="Razorpay" ok={!!status?.razorpay_auth_ok} />
              <Pill
                label="Public URL"
                ok={!!status?.env?.NEXT_PUBLIC_APP_URL}
                note={status?.env?.NEXT_PUBLIC_APP_URL || undefined}
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <button className="btn ghost" onClick={refreshStatus} disabled={loadingStatus}>
                {loadingStatus ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            {status?.errors?.length ? (
              <div style={{ marginTop: 10, color: "var(--danger)" }}>Errors: {status.errors.join(" | ")}</div>
            ) : null}
            {warnList.length ? (
              <div className="muted" style={{ marginTop: 6 }}>Missing/invalid: {warnList.join(", ")}</div>
            ) : null}
          </div>
        </div>

        {/* Recent conversations */}
        <div className="card">
          <div className="card-body">
            <div className="card-title">Recent Conversations</div>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr><th>Contact</th><th>Status</th><th>Updated</th></tr>
                </thead>
                <tbody>
                  {(convs?.length ? convs.slice(0, 8) : []).map((c) => (
                    <tr key={c.id}>
                      <td>{contacts[c.contact_id]?.name || c.contact_id}</td>
                      <td><span className={`pill ${c.status === "paid" ? "ok" : ""}`}>{c.status}</span></td>
                      <td>{new Date(c.updated_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {!convs?.length && (
                    <tr><td colSpan={3} className="muted">No activity yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 10 }}>
              <a className="btn ghost" href="/inbox">Open Inbox →</a>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS — always visible now */}
      <section className="grid grid-3" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-body">
            <div className="card-title">Send Template</div>
            <div className="grid">
              <input className="input" placeholder="Recipient (E.164 digits, no +)" value={to} onChange={(e)=>setTo(e.target.value)} />
              <div className="grid grid-2">
                <input className="input" placeholder="Template name" value={tplName} onChange={(e)=>setTplName(e.target.value)} />
                <input className="input" placeholder="Language code" value={tplLang} onChange={(e)=>setTplLang(e.target.value)} />
              </div>
              <button className="btn" onClick={sendTemplate}>Send Template</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="card-title">Send Text (session)</div>
            <div className="grid">
              <input className="input" placeholder="Recipient (E.164 digits, no +)" value={to} onChange={(e)=>setTo(e.target.value)} />
              <textarea className="textarea" rows={3} placeholder="Message" value={text} onChange={(e)=>setText(e.target.value)} />
              <button className="btn" onClick={sendText}>Send Text</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="card-title">Payment Link → WhatsApp</div>
            <div className="grid">
              <input className="input" placeholder="Recipient (E.164 digits, no +)" value={to} onChange={(e)=>setTo(e.target.value)} />
              <div className="grid grid-2">
                <input className="input" type="number" min={100} value={amount} onChange={(e)=>setAmount(parseInt(e.target.value || "0"))} />
                <input className="input" placeholder="Description" value={desc} onChange={(e)=>setDesc(e.target.value)} />
              </div>
              <button className="btn" onClick={createLinkAndSend}>Create Link & Send</button>
            </div>
          </div>
        </div>

        {actionMsg && (
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="card-body muted">{actionMsg}</div>
          </div>
        )}
      </section>
    </main>
  );
}

function Pill({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <div className={`pill ${ok ? "ok" : "warn"}`} title={note}>
      {label} {note ? `· ${note}` : ""}
    </div>
  );
}
