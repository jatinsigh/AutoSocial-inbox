"use client";

import { useState } from "react";

export default function Home() {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState(49900);
  const [desc, setDesc] = useState("Demo class");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function handleCreateAndSend() {
    setSending(true);
    setMessage("");
    try {
      const res = await fetch("/api/payments/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, description: desc })
      }).then(r => r.json());

      if (!res.short_url) throw new Error("Failed to create payment link");

      const wa = await fetch("/api/wa/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          kind: "text",
          text: `Here’s your payment link: ${res.short_url}`
        })
      }).then(r => r.json());

      setMessage(`Link created: ${res.short_url}. WA send id: ${wa.id || "ok"}`);
    } catch (e: any) {
      setMessage(e.message || "Error");
    } finally {
      setSending(false);
    }
  }

  return (
    <main>
      <h1>AutoSocial Inbox — MVP</h1>
      <p>Quick demo: create a Razorpay Payment Link then send it via WhatsApp.</p>

      <div style={{ display: "grid", gap: 8, maxWidth: 480, marginTop: 16 }}>
        <label>
          WhatsApp number (E.164 without +):
          <input value={to} onChange={e => setTo(e.target.value)} placeholder="9198xxxxxxx"
            style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          Amount (paise):
          <input type="number" value={amount} onChange={e => setAmount(parseInt(e.target.value || "0"))}
            style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          Description:
          <input value={desc} onChange={e => setDesc(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </label>
        <button disabled={sending} onClick={handleCreateAndSend} style={{ padding: 10 }}>
          {sending ? "Working..." : "Create link + Send WA"}
        </button>
        {message && <div style={{ paddingTop: 8 }}>{message}</div>}
      </div>

      <hr style={{ margin: "24px 0" }} />
      <p>Set WhatsApp webhook to <code>/api/webhooks/whatsapp</code> and Razorpay webhook to <code>/api/webhooks/razorpay</code>.</p>
    </main>
  );
}
