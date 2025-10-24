"use client";

import { useEffect, useState } from "react";
import Protected from "../components/Protected";

type CredsView = {
  whatsapp: { phone_id_masked: string | null; graph_version: string; token_masked: string | null };
  razorpay: { key_id_masked: string | null; key_secret_masked: string | null; webhook_secret_masked: string | null };
};

export default function SettingsPage() {
  const [view, setView] = useState<CredsView | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // inputs
  const [waPhoneId, setWaPhoneId] = useState("");
  const [waToken, setWaToken] = useState("");
  const [graphVersion, setGraphVersion] = useState("v20.0");

  const [rzKeyId, setRzKeyId] = useState("");
  const [rzKeySecret, setRzKeySecret] = useState("");
  const [rzWebhookSecret, setRzWebhookSecret] = useState("");

  async function saveWA() {
    setSaving(true); setMsg("");
    const res = await fetch("/api/settings/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wa_phone_id: waPhoneId || undefined,
        wa_token: waToken || undefined,
        graph_version: graphVersion || undefined,
      }),
    }).then(r => r.json());
    setSaving(false);
    if (res?.error) return setMsg(`Save error: ${res.error}`);
    setMsg("WhatsApp settings saved.");
    setWaPhoneId(""); setWaToken("");
  }

  async function saveRZ() {
    setSaving(true); setMsg("");
    const res = await fetch("/api/settings/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_key_id: rzKeyId || undefined,
        razorpay_key_secret: rzKeySecret || undefined,
        razorpay_webhook_secret: rzWebhookSecret || undefined,
      }),
    }).then(r => r.json());
    setSaving(false);
    if (res?.error) return setMsg(`Save error: ${res.error}`);
    setMsg("Razorpay settings saved.");
    setRzKeyId(""); setRzKeySecret(""); setRzWebhookSecret("");
  }

  return (
     <Protected>
      <div style={{ padding: 16 }}>
    <main style={{ display: "grid", gap: 16, maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Settings</h1>
        <a href="/" style={{ marginLeft: "auto" }}>
          <button style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd" }}>Home</button>
        </a>
        <a href="/inbox">
          <button style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd" }}>Inbox</button>
        </a>
      </div>

      {msg && <div style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8, background: "#f8f8f8" }}>{msg}</div>}

      {/* WhatsApp */}
      <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, background: "#fff" }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>WhatsApp (Cloud API)</div>
        <div style={{ color: "#666", marginBottom: 10, fontSize: 13 }}>
          Current:
          <ul style={{ margin: 0 }}>
            <li>Phone ID: {view?.whatsapp?.phone_id_masked || "—"}</li>
            <li>Token: {view?.whatsapp?.token_masked || "—"}</li>
            <li>Graph Version: {view?.whatsapp?.graph_version || "v20.0"}</li>
          </ul>
        </div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr auto" }}>
          <input placeholder="Phone Number ID" value={waPhoneId} onChange={e=>setWaPhoneId(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}/>
          <input placeholder="Access Token" value={waToken} onChange={e=>setWaToken(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}/>
          <input placeholder="Graph Version" value={graphVersion} onChange={e=>setGraphVersion(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}/>
          <button onClick={saveWA} disabled={saving} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </section>

      {/* Razorpay */}
      <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, background: "#fff" }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Razorpay</div>
        <div style={{ color: "#666", marginBottom: 10, fontSize: 13 }}>
          Current:
          <ul style={{ margin: 0 }}>
            <li>Key ID: {view?.razorpay?.key_id_masked || "—"}</li>
            <li>Key Secret: {view?.razorpay?.key_secret_masked || "—"}</li>
            <li>Webhook Secret: {view?.razorpay?.webhook_secret_masked || "—"}</li>
          </ul>
        </div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr auto" }}>
          <input placeholder="Key ID" value={rzKeyId} onChange={e=>setRzKeyId(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}/>
          <input placeholder="Key Secret" value={rzKeySecret} onChange={e=>setRzKeySecret(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}/>
          <input placeholder="Webhook Secret" value={rzWebhookSecret} onChange={e=>setRzWebhookSecret(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}/>
          <button onClick={saveRZ} disabled={saving} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </section>

      <p style={{ color: "#666", fontSize: 12 }}>
        Notes: values are stored encrypted at rest. For production, rotate tokens regularly and restrict least-privilege.
      </p>
    </main>
    </div>
    </Protected>
  );
}
