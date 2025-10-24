import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/authServer";
import { getSecretsForUser } from "@/lib/runtimeConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, error } = await requireUser(req);
  if (!user) return new Response(JSON.stringify({ error: error || "unauthorized" }), { status: 401 });

  const { conversation_id, to, body } = await req.json();
  if (!conversation_id || !to || !body) return new Response(JSON.stringify({ error: "conversation_id, to, body required" }), { status: 400 });

  const cfg = await getSecretsForUser(user.id);
  if (!cfg.WA_TOKEN || !cfg.WA_PHONE_ID) return new Response(JSON.stringify({ error: "WhatsApp not configured" }), { status: 400 });

  const res = await fetch(`https://graph.facebook.com/${cfg.GRAPH_VERSION}/${cfg.WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.WA_TOKEN}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
  });

  if (!res.ok) {
    const t = await res.text();
    return new Response(JSON.stringify({ error: `WA send failed: ${res.status} ${t}` }), { status: 500 });
  }

  const j = await res.json().catch(() => ({}));
  const outId = j?.messages?.[0]?.id || crypto.randomUUID();

  const supa = supabaseAdmin();
  await supa.from("messages").insert({
    id: outId, conversation_id, direction: "out", type: "text", text: body,
    wa_message_id: outId, status: "sent", sent_at: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ ok: true, id: outId }), { status: 200 });
}
