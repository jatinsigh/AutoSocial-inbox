import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supa = supabaseAdmin();
  const { data, error } = await supa
    .from("messages")
    .select("id, direction, type, text, status, sent_at, received_at")
    .eq("conversation_id", params.id)
    .order("received_at", { ascending: true })
    .order("sent_at", { ascending: true });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ messages: data || [] }), { status: 200 });
}
