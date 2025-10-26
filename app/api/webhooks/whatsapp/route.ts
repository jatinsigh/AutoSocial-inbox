import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ---------- Config ---------- */
const GRAPH_VERSION = process.env.GRAPH_VERSION || "v20.0";
const WA_TOKEN = process.env.WA_TOKEN!;
const WA_PHONE_ID = process.env.WA_PHONE_ID!;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const ATTACH_BUCKET = "attachments"; // private bucket

/** ---------- Helpers ---------- */
function nowInTZ(tz: string) {
  try {
    return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  } catch {
    return new Date();
  }
}
function isOutsideBusinessHours(bh: { tz: string; open: string; close: string }) {
  const n = nowInTZ(bh.tz);
  const [oh, om] = (bh.open || "09:00").split(":").map(Number);
  const [ch, cm] = (bh.close || "18:00").split(":").map(Number);
  const open = new Date(n); open.setHours(oh, om, 0, 0);
  const close = new Date(n); close.setHours(ch, cm, 0, 0);
  return n < open || n > close;
}
async function lastInboundTsISO(supa: any, conversationId: string) {
  const { data } = await supa
    .from("messages")
    .select("received_at, direction")
    .eq("conversation_id", conversationId)
    .eq("direction", "in")
    .order("received_at", { ascending: false })
    .limit(1);
  return data?.[0]?.received_at as string | null;
}
function within24h(iso?: string | null) {
  if (!iso) return false;
  const diffMs = Date.now() - new Date(iso).getTime();
  return diffMs <= 24 * 60 * 60 * 1000;
}
async function sendSessionText(to: string, text: string) {
  const url = `${GRAPH_BASE}/${WA_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${WA_TOKEN}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`WA send failed: ${res.status} ${t}`);
  }
  return res.json();
}

/** Media helpers */
async function fetchMediaMeta(mediaId: string): Promise<{ url: string; mime_type?: string; file_size?: number }> {
  const res = await fetch(`${GRAPH_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`media meta failed ${res.status}`);
  const j = await res.json();
  return { url: j.url, mime_type: j.mime_type, file_size: j.file_size };
}
async function downloadMediaBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${WA_TOKEN}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`media download failed ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(new Uint8Array(ab));
}

/** ---------- GET: webhook verification ---------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/** ---------- POST: message/status events (with media) ---------- */
export async function POST(req: Request) {
  // ---- env / config ----
  const GRAPH_VERSION = process.env.GRAPH_VERSION || "v20.0";
  const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
  const WA_TOKEN = process.env.WA_TOKEN!;
  const ATTACH_BUCKET = "attachments";

  // ---- helpers kept local to POST for a single-file drop-in ----
  function isoFromWaTs(ts?: string | number | null) {
    if (!ts) return new Date().toISOString();
    const n = typeof ts === "string" ? parseInt(ts, 10) : ts;
    if (Number.isFinite(n)) return new Date(n * 1000).toISOString();
    return new Date().toISOString();
  }

  async function fetchMediaMeta(mediaId: string): Promise<{ url: string; mime_type?: string; file_size?: number }> {
    const r = await fetch(`${GRAPH_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${WA_TOKEN}` },
      cache: "no-store",
    });

    console.log("Media meta response status >", r.status);
    if (!r.ok) throw new Error(`media meta failed ${r.status}`);
    return r.json();
  }

  async function downloadMediaBuffer(url: string): Promise<Buffer> {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${WA_TOKEN}` },
      cache: "no-store",
    });
    console.log("Media download response status >", r.status);
    if (!r.ok) throw new Error(`media download failed ${r.status}`);
    const ab = await r.arrayBuffer();
    return Buffer.from(new Uint8Array(ab));
  }

  // ---- read body ----
  const body = await req.json().catch(() => ({}));
  // console.log("[WA] webhook >", JSON.stringify(body, null, 2)); // enable when debugging

  const entries = Array.isArray(body?.entry) ? body.entry : [];
  if (!entries.length) return new Response("ok");

  const supa = supabaseAdmin();

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};

      // contacts array (for names)
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      const nameById = new Map<string, string | null>();
      for (const c of contacts) {
        if (c?.wa_id) nameById.set(c.wa_id, c?.profile?.name ?? null);
      }

      // ----- inbound messages (0..n) -----
      const messages = Array.isArray(value?.messages) ? value.messages : [];
      for (const m of messages) {
        try {
          const waId: string = m.from; // user's WA (digits, no '+')
          const type: string = m.type;
          const tsISO = isoFromWaTs(m.timestamp);
          const contactName = nameById.get(waId) ?? null;

          // (1) upsert contact
          const { error: contactErr } = await supa
            .from("contacts")
            .upsert({ wa_id: waId, name: contactName }, { onConflict: "wa_id" });
          if (contactErr) console.error("[WA] contact upsert error", contactErr);

          // (2) ensure conversation
          let conversationId: string | undefined;
          {
            const { data: existing, error: selErr } = await supa
              .from("conversations")
              .select("id")
              .eq("contact_id", waId)
              .limit(1)
              .maybeSingle();
            if (selErr) console.error("[WA] select conversation error", selErr);

            if (existing?.id) {
              conversationId = existing.id;
            } else {
              const { data: created, error: insErr } = await supa
                .from("conversations")
                .insert({ id: crypto.randomUUID(), contact_id: waId, status: "open", updated_at: tsISO })
                .select("id")
                .single();
              if (insErr) console.error("[WA] create conversation error", insErr);
              conversationId = created?.id;
            }
          }
          if (!conversationId) {
            console.error("[WA] no conversationId for wa_id", waId);
            continue;
          }

          // (3) text messages
          if (type === "text") {
            const { error: msgErr } = await supa.from("messages").insert({
              id: m.id,
              conversation_id: conversationId,
              direction: "in",
              type: "text",
              text: m.text?.body ?? null,
              wa_message_id: m.id,
              status: "received",
              received_at: tsISO,
            });
            if (msgErr) console.error("[WA] insert inbound text error", msgErr);
          }

          // (4) media messages (image/document/video/audio)
          if (type === "image" || type === "document" || type === "video" || type === "audio") {
            try {
              const mediaId: string | undefined =
                m[type]?.id || m.image?.id || m.document?.id || m.video?.id || m.audio?.id;
              if (!mediaId) throw new Error(`No media id for type ${type}`);

              // 4.a meta -> url
              const meta = await fetchMediaMeta(mediaId);
              // 4.b download
              const buf = await downloadMediaBuffer(meta.url);
              // 4.c upload to storage (private)
              const origName =
                (type === "document" ? m.document?.filename : undefined) ||
                `${type}-${mediaId}`;
              const safeName = origName.replace(/\s+/g, "_");
              const storagePath = `${waId}/${mediaId}-${safeName}`;

              const upload = await supa.storage
                .from(ATTACH_BUCKET)
                .upload(storagePath, buf, {
                  contentType: (m[type]?.mime_type as string) || meta.mime_type || "application/octet-stream",
                  upsert: true,
                });
              if (upload.error) console.error("[WA] storage upload error", upload.error);

              // 4.d insert message bubble
              const { error: msgErr } = await supa.from("messages").insert({
                id: m.id,
                conversation_id: conversationId,
                direction: "in",
                type,
                text: m.caption ?? null,
                wa_message_id: m.id,
                status: "received",
                received_at: tsISO,
              });
              if (msgErr) console.error("[WA] insert inbound media message error", msgErr);

              // 4.e insert attachment row
              const { error: attErr } = await supa.from("attachments").insert({
                message_id: m.id,
                conversation_id: conversationId,
                media_type: type,
                mime_type: (m[type]?.mime_type as string) || meta.mime_type || "application/octet-stream",
                file_name: origName,
                file_size: (meta.file_size as number | undefined) ?? buf.byteLength,
                storage_path: storagePath,
              });
              if (attErr) console.error("[WA] insert attachment error", attErr);
            } catch (e: any) {
              console.error("[WA] media handling error", e?.message || e);
            }
          }

          // (5) keep conversation fresh
          const { error: updErr } = await supa
            .from("conversations")
            .update({ updated_at: tsISO })
            .eq("id", conversationId);
          if (updErr) console.error("[WA] conversation updated_at error", updErr);
        } catch (e: any) {
          console.error("[WA] message loop error", e?.message || e);
        }
      }

      // ----- delivery/read status updates (0..n) -----
      const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
      for (const s of statuses) {
        try {
          const tsISO = isoFromWaTs(s.timestamp);
          const { error: stErr } = await supa
            .from("messages")
            .update({ status: s.status, received_at: tsISO })
            .eq("wa_message_id", s.id);
          if (stErr) console.error("[WA] update status error", stErr);
        } catch (e: any) {
          console.error("[WA] status loop error", e?.message || e);
        }
      }
    }
  }

  return new Response("ok");
}

