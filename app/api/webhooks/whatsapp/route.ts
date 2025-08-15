import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  console.log("WA WEBHOOK >", JSON.stringify(body, null, 2)); // ✅ add this
  const change = body?.entry?.[0]?.changes?.[0]?.value;
  if (!change) return new Response("ok");

  const supa = supabaseAdmin();

  const msg = change?.messages?.[0];
  const status = change?.statuses?.[0];

  if (msg) {
    const wa_id = msg.from; // E.164 without +
    const name = change?.contacts?.[0]?.profile?.name || null;
    // 1) upsert contact
    await supa
      .from("contacts")
      .upsert({ wa_id, name }, { onConflict: "wa_id" });

    // 2) find or create conversation
    const { data: existing } = await supa
      .from("conversations")
      .select("id")
      .eq("contact_id", wa_id)  // simplified: using wa_id as contact_id for MVP
      .limit(1).maybeSingle();

    let convId = existing?.id;
    if (!convId) {
      const { data: created } = await supa
        .from("conversations")
        .insert({ id: crypto.randomUUID(), contact_id: wa_id, status: "open" })
        .select().single();
      convId = created?.id;
    }

    // 3) store message
    await supa.from("messages").insert({
      id: msg.id,
      conversation_id: convId,
      direction: "in",
      type: msg.type,
      text: msg.text?.body ?? null,
      wa_message_id: msg.id,
      status: "received",
      received_at: new Date().toISOString()
    });
  }

  if (status) {
    // Update delivery/read status of outbound message
    await supa
      .from("messages")
      .update({ status: status.status, received_at: new Date(parseInt(status.timestamp, 10) * 1000).toISOString() })
      .eq("wa_message_id", status.id);
  }

  return new Response("ok");
}
