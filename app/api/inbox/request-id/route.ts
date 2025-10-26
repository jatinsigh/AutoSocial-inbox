export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const GRAPH_VERSION = process.env.GRAPH_VERSION || "v20.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const WA_TOKEN = process.env.WA_TOKEN!;
const WA_PHONE_ID = process.env.WA_PHONE_ID!;

async function sendWaText(toE164Digits: string, body: string) {
  const res = await fetch(`${GRAPH_BASE}/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toE164Digits, // digits only, with country code, no '+'
      type: "text",
      text: { body },
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error?.message || "WA send failed");
  return j;
}

export async function POST(req: NextRequest) {
  const { conversation_id, to } = await req.json();
  if (!conversation_id || !to) {
    return new Response(JSON.stringify({ error: "conversation_id and to are required" }), { status: 400 });
  }

  const supa = supabaseAdmin();
  const msgText =
    "For verification, please share your government ID.\n" +
    "• Upload a clear photo or a PDF as a *document* here in WhatsApp.\n" +
    "• Ensure all details are readable (no crop/blur).";

  const waResp = await sendWaText(to, msgText);
  const outId = waResp?.messages?.[0]?.id ?? `local_${Date.now()}`;

  await supa.from("messages").insert({
    id: outId,
    conversation_id,
    direction: "out",
    type: "text",
    text: msgText,
    wa_message_id: outId,
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
