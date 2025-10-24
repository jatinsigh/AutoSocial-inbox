import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supa = supabaseAdmin();

  // last 50 convos by recent activity
  const { data: convs, error } = await supa
    .from("conversations")
    .select("id, contact_id, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const waIds = Array.from(new Set((convs || []).map((c) => c.contact_id))).filter(Boolean);
  let contactMap: Record<string, { name: string | null }> = {};
  if (waIds.length) {
    const { data: contacts } = await supa.from("contacts").select("wa_id, name").in("wa_id", waIds);
    for (const c of contacts || []) contactMap[c.wa_id] = { name: c.name };
  }

  return new Response(JSON.stringify({ conversations: convs || [], contacts: contactMap }), { status: 200 });
}
