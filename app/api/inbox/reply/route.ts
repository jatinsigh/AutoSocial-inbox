import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/authServer";
import { sendText, sendTemplate } from "@/lib/wa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // const { user, error } = await requireUser(req);
  // if (!user) return new Response(JSON.stringify({ error: error || "unauthorized" }), { status: 401 });

  const { conversation_id, to, kind, text, template } = await req.json();
  if (!conversation_id || !to) {
    return new Response(JSON.stringify({ error: "conversation_id and to required" }), { status: 400 });
  }

  const supa = supabaseAdmin();

  try {
    const result = kind === "template"
      ? await sendTemplate({ to, template })
      : await sendText({ to, text });

    const waId = result?.messages?.[0]?.id || crypto.randomUUID();
    const now = new Date().toISOString();

    await supa.from("messages").insert({
      id: waId,
      conversation_id,
      direction: "out",
      type: kind === "template" ? "template" : "text",
      text: kind === "template" ? null : text,
      wa_message_id: waId,
      status: "sent",
      sent_at: now,
    });

    // NEW: keep conversation fresh so it bubbles up immediately
    await supa.from("conversations").update({ updated_at: now }).eq("id", conversation_id);

    return new Response(JSON.stringify({ ok: true, id: waId }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
