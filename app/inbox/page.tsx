"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Protected from "../components/Protected";

type Conv = { id: string; contact_id: string; status: string; updated_at: string };
type ContactMap = Record<string, { name: string | null }>;
type Msg = {
  id: string;
  direction: "in" | "out";
  type: string | null;
  text: string | null;
  status: string | null;
  sent_at: string | null;
  received_at: string | null;
};

export default function InboxPage() {
  // Conversations + contacts
  const [convs, setConvs] = useState<Conv[]>([]);
  const [contacts, setContacts] = useState<ContactMap>({});
  const [selected, setSelected] = useState<Conv | null>(null);
  const [search, setSearch] = useState("");

  // Messages + reply
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  // Quick replies
  const [qrs, setQrs] = useState<{ id: string; label: string; body: string }[]>([]);
  const [qrLabel, setQrLabel] = useState("");
  const [qrBody, setQrBody] = useState("");

  // Payment link helper
  const [amount, setAmount] = useState<number>(49900); // paise

  // ---- Smart autoscroll state/refs ----
  const threadRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);          // true when user is near bottom
  const lastMsgIdRef = useRef<string | null>(null);
  const pendingNewRef = useRef(false);         // set when a new bottom message arrives
  const [showJump, setShowJump] = useState(false);

  const filteredConvs = useMemo(() => {
    if (!search.trim()) return convs;
    const q = search.toLowerCase();
    return convs.filter((c) => {
      const nm = contacts[c.contact_id]?.name || c.contact_id;
      return nm.toLowerCase().includes(q) || c.contact_id.includes(q);
    });
  }, [convs, contacts, search]);

  const selectedName = useMemo(
    () => (selected ? contacts[selected.contact_id]?.name || selected.contact_id : ""),
    [selected, contacts]
  );

  // --- loaders ---
  async function loadConvs() {
    const r = await fetch("/api/inbox/conversations", { cache: "no-store" }).then((r) => r.json());
    setConvs(r.conversations || []);
    setContacts(r.contacts || {});
    if (!selected && r.conversations?.length) setSelected(r.conversations[0]);
  }

  async function loadMsgs(id: string) {
    const r = await fetch(`/api/inbox/messages/${id}`, { cache: "no-store" }).then((r) => r.json());
    const newMsgs: Msg[] = r.messages || [];
    const newLast = newMsgs[newMsgs.length - 1]?.id || null;

    // mark if a truly new bottom message arrived
    pendingNewRef.current = !!(newLast && newLast !== lastMsgIdRef.current);
    lastMsgIdRef.current = newLast;

    setMsgs(newMsgs);
  }

  async function loadQRs() {
    const r = await fetch("/api/inbox/quick-replies", { cache: "no-store" }).then((r) => r.json());
    setQrs(r.quick_replies || []);
  }

  // ---- scrolling helpers ----
  function isNearBottom(el: HTMLDivElement, threshold = 120) {
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }

  function handleThreadScroll() {
    const el = threadRef.current;
    if (!el) return;
    const atBottom = isNearBottom(el);
    autoScrollRef.current = atBottom;
    setShowJump(!atBottom);
  }

  function scrollToBottom(smooth = true) {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  // When messages change, only autoscroll if:
  // 1) there is a new bottom message AND
  // 2) user is near the bottom (autoScrollRef true)
  useEffect(() => {
    if (pendingNewRef.current && autoScrollRef.current) {
      scrollToBottom(true);
    }
    // clear the "new" flag after we respond to it
    pendingNewRef.current = false;
  }, [msgs]);

  // When conversation changes, reset scroll prefs and go to bottom after first load
  useEffect(() => {
    lastMsgIdRef.current = null;
    pendingNewRef.current = false;
    autoScrollRef.current = true;
    setShowJump(false);
    if (selected?.id) {
      loadMsgs(selected.id).then(() => scrollToBottom(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // --- actions ---
  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    const to = selected.contact_id;
    const res = await fetch("/api/inbox/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: selected.id, to, kind: "text", text: reply }),
    }).then((r) => r.json());
    setSending(false);
    if (res?.error) {
      alert(res.error);
      return;
    }
    setReply("");
    // A new message will arrive on next poll; we let the auto-scroll logic handle it.
    loadMsgs(selected.id);
  }

  async function sendQuick(body: string) {
    if (!selected) return;
    const to = selected.contact_id;
    const res = await fetch("/api/inbox/send-quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: selected.id, to, body }),
    }).then((r) => r.json());
    if (res?.error) {
      alert(res.error);
      return;
    }
    loadMsgs(selected.id);
  }

  async function addQR() {
    if (!qrLabel.trim() || !qrBody.trim()) return;
    const r = await fetch("/api/inbox/quick-replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: qrLabel.trim(), body: qrBody.trim() }),
    }).then((r) => r.json());
    if (r?.error) {
      alert(r.error);
      return;
    }
    setQrLabel("");
    setQrBody("");
    loadQRs();
  }

  async function createAndSendLink() {
    if (!selected) return;
    if (!amount || amount < 100) return alert("Enter a valid amount in paise (e.g., 49900 for ₹499)");
    const res = await fetch("/api/payments/create-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        description: "Payment",
        contact_wa_id: selected.contact_id,
        conversation_id: selected.id,
      }),
    }).then((r) => r.json());

    if (res?.short_url) {
      await fetch("/api/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: selected.id,
          to: selected.contact_id,
          kind: "text",
          text: `Here’s your payment link: ${res.short_url}`,
        }),
      });
      loadMsgs(selected.id);
    } else {
      alert(res?.error || "Could not create link");
    }
  }

  // --- polling ---
  useEffect(() => {
    loadConvs();
    loadQRs();
    const t1 = setInterval(loadConvs, 5000);
    return () => clearInterval(t1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    loadMsgs(selected.id);
    const t2 = setInterval(() => loadMsgs(selected.id), 3000);
    return () => clearInterval(t2);
  }, [selected]);

  return (
    <Protected>
      <div style={{ padding: 16 }}>
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, height: "calc(100vh - 40px)" }}>
      {/* Left: Conversations */}
      <aside style={{ borderRight: "1px solid #eee", overflow: "auto", paddingRight: 8 }}>
        <div style={{ position: "sticky", top: 0, background: "#fff", padding: "8px 0" }}>
          <h2 style={{ margin: 0 }}>Conversations</h2>
          <input
            placeholder="Search name/number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", marginTop: 8 }}
          />
        </div>

        {filteredConvs.length === 0 && <div style={{ color: "#666", marginTop: 10 }}>No conversations.</div>}
        {filteredConvs.map((c) => (
          <div
            key={c.id}
            onClick={() => setSelected(c)}
            style={{
              padding: 10,
              cursor: "pointer",
              borderRadius: 8,
              marginBottom: 6,
              background: selected?.id === c.id ? "#f5f5f5" : "transparent",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {contacts[c.contact_id]?.name || c.contact_id}
            </div>
            <div
              style={{
                fontSize: 12,
                color: c.status === "paid" ? "#0a7d00" : "#666",
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: "0 8px",
                  background: c.status === "paid" ? "#eaffea" : "transparent",
                }}
              >
                {c.status}
              </span>
              <span>{new Date(c.updated_at).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </aside>

      {/* Right: Thread */}
      <section style={{ display: "grid", gridTemplateRows: "auto 1fr auto auto", gap: 10 }}>
        {/* Header */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>{selectedName || "Select a conversation"}</h2>
          {selected && (
            <>
              <span
                style={{
                  fontSize: 12,
                  color: selected.status === "paid" ? "#0a7d00" : "#666",
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: "2px 8px",
                  background: selected.status === "paid" ? "#eaffea" : "transparent",
                }}
              >
                {selected.status}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                <input
                  type="number"
                  min={100}
                  value={amount}
                  onChange={(e) => setAmount(parseInt(e.target.value || "0"))}
                  style={{ width: 120, padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}
                  title="Amount (in paise): 49900 = ₹499"
                />
                <button
                  onClick={createAndSendLink}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                  disabled={!selected}
                  title="Create and send a payment link"
                >
                  Send Payment Link
                </button>
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        <div
          ref={threadRef}
          onScroll={handleThreadScroll}
          style={{ position: "relative", overflow: "auto", border: "1px solid #eee", borderRadius: 10, padding: 12, background: "#fff" }}
        >
          {selected ? (
            msgs.length ? (
              msgs.map((m) => (
                <div
                  key={m.id}
                  style={{ display: "flex", justifyContent: m.direction === "out" ? "flex-end" : "flex-start", marginBottom: 8 }}
                >
                  <div
                    style={{
                      maxWidth: 520,
                      padding: "8px 12px",
                      borderRadius: 12,
                      background: m.direction === "out" ? "#DCF8C6" : "#fff",
                      border: "1px solid #eee",
                    }}
                  >
                    <div style={{ whiteSpace: "pre-wrap" }}>{m.text || <i>{m.type}</i>}</div>
                    <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>
                      {m.direction === "out"
                        ? (m.status || "sent")
                        : (m.received_at ? new Date(m.received_at).toLocaleTimeString() : "")}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: "#666" }}>No messages yet in this thread.</div>
            )
          ) : (
            <div style={{ color: "#666" }}>Choose a conversation to view messages.</div>
          )}
          <div ref={chatEndRef} />
          {/* Jump to bottom button */}
          {showJump && (
            <button
              onClick={() => {
                autoScrollRef.current = true;
                scrollToBottom(true);
              }}
              style={{
                position: "sticky",
                left: 0,
                right: 0,
                bottom: 0,
                margin: "8px auto 0",
                display: "block",
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: "#f8f8f8",
              }}
            >
              Jump to bottom ↓
            </button>
          )}
        </div>

        {/* Reply box */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Type a reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && reply.trim()) sendReply();
            }}
            disabled={!selected}
          />
          <button
            onClick={sendReply}
            disabled={!selected || !reply.trim() || sending}
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
            title="Sends a session message (requires the 24h window to be open)"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>

        {/* Quick Replies */}
        <div style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Quick Replies</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {qrs.map((q) => (
              <button
                key={q.id}
                onClick={() => sendQuick(q.body)}
                style={{ padding: "6px 10px", borderRadius: 12, border: "1px solid #ddd", background: "#f8f8f8" }}
                disabled={!selected}
                title={q.body}
              >
                {q.label}
              </button>
            ))}
            {!qrs.length && <div style={{ color: "#666" }}>Add your first quick reply below.</div>}
          </div>

          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 2fr auto" }}>
            <input
              placeholder="Label (e.g., Fees)"
              value={qrLabel}
              onChange={(e) => setQrLabel(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
            />
            <input
              placeholder="Message body"
              value={qrBody}
              onChange={(e) => setQrBody(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
            />
            <button onClick={addQR} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd" }}>
              Add
            </button>
          </div>
        </div>
      </section>
    </div>
          </div>
    </Protected>

  );
}
