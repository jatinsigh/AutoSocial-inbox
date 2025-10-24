import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const url = `https://graph.facebook.com/${process.env.GRAPH_VERSION}/${process.env.WA_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WA_TOKEN}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`WA send failed: ${res.status} ${t}`);
  }
  return res.json();
}

/** ---------- GET: webhook verification ---------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/** ---------- POST: message/status events ---------- */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  // console.log("WA WEBHOOK >", JSON.stringify(body, null, 2)); // uncomment while debugging

  const change = body?.entry?.[0]?.changes?.[0]?.value;
  if (!change) return new Response("ok");

  const supa = supabaseAdmin();

  const msg = change?.messages?.[0];
  const status = change?.statuses?.[0];

  /** ----- Handle inbound user message ----- */
  if (msg) {
    const wa_id = msg.from; // E.164 without '+'
    const name = change?.contacts?.[0]?.profile?.name || null;

    // 1) upsert contact
    await supa.from("contacts").upsert({ wa_id, name }, { onConflict: "wa_id" });

    // 2) find or create conversation (MVP: contact_id == wa_id)
    let convId: string | undefined;
    {
      const { data: existing, error: selErr } = await supa
        .from("conversations")
        .select("id")
        .eq("contact_id", wa_id)
        .limit(1)
        .maybeSingle();
      if (selErr) console.error("select conversation error", selErr);
      convId = existing?.id;
      if (!convId) {
        const { data: created, error: insErr } = await supa
          .from("conversations")
          .insert({ id: crypto.randomUUID(), contact_id: wa_id, status: "open" })
          .select("id")
          .single();
        if (insErr) console.error("create conversation error", insErr);
        convId = created?.id;
      }
    }

    // 3) store inbound message
    try {
      await supa.from("messages").insert({
        id: msg.id,
        conversation_id: convId!,
        direction: "in",
        type: msg.type,
        text: msg.text?.body ?? null,
        wa_message_id: msg.id,
        status: "received",
        received_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("insert inbound message error", e);
    }

    // 4) Automations (business hours + keyword rules), respecting 24h window
    try {
      const { data: settingsRow } = await supa
        .from("app_settings")
        .select("*")
        .eq("id", "default")
        .maybeSingle();
      const settings = settingsRow || {};
      const autoEnabled = settings?.auto_reply_enabled !== false;

      const lastIn = await lastInboundTsISO(supa, convId!);
      const canSessionSend = within24h(lastIn);

      // Business-hours autoresponder (avoid spamming; only if no outbound in last 10 min)
      if (autoEnabled && settings?.business_hours && isOutsideBusinessHours(settings.business_hours)) {
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: recentOut } = await supa
          .from("messages")
          .select("id")
          .eq("conversation_id", convId!)
          .eq("direction", "out")
          .gte("sent_at", tenMinAgo)
          .limit(1);

        if (!recentOut?.length && canSessionSend) {
          const text = `Thanks for your message! We’ll reply between ${settings.business_hours.open}-${settings.business_hours.close}.`;
          const r = await sendSessionText(wa_id, text).catch((e) => {
            console.error("auto BH send failed", e);
            return null;
          });
          const outId = r?.messages?.[0]?.id || crypto.randomUUID();
          await supa.from("messages").insert({
            id: outId,
            conversation_id: convId!,
            direction: "out",
            type: "text",
            text,
            wa_message_id: outId,
            status: "sent",
            sent_at: new Date().toISOString(),
          });
        }
      }

      // Keyword rules (simple contains)
      if (autoEnabled && msg?.type === "text" && settings?.keyword_rules) {
        const incoming = (msg.text?.body || "").toLowerCase();
        const rules: Array<{ match: string; reply: string }> = settings.keyword_rules;
        const hit = rules.find((r) => incoming.includes(r.match.toLowerCase()));
        if (hit && canSessionSend) {
          const r = await sendSessionText(wa_id, hit.reply).catch((e) => {
            console.error("auto keyword send failed", e);
            return null;
          });
          const outId = r?.messages?.[0]?.id || crypto.randomUUID();
          await supa.from("messages").insert({
            id: outId,
            conversation_id: convId!,
            direction: "out",
            type: "text",
            text: hit.reply,
            wa_message_id: outId,
            status: "sent",
            sent_at: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      // If app_settings table doesn't exist yet, just continue.
      console.error("automation error", e);
    }
  }

  /** ----- Handle outbound delivery/read status ----- */
  if (status) {
    try {
      const ts = status.timestamp ? new Date(parseInt(status.timestamp, 10) * 1000).toISOString() : new Date().toISOString();
      await supa
        .from("messages")
        .update({ status: status.status, received_at: ts })
        .eq("wa_message_id", status.id);
    } catch (e) {
      console.error("update status error", e);
    }
  }

  return new Response("ok");
}
