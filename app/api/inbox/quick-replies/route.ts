import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supa = supabaseAdmin();
  const { data, error } = await supa
    .from("quick_replies")
    .select("id,label,body")
    .order("created_at", { ascending: true });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ quick_replies: data || [] }), { status: 200 });
}

export async function POST(req: Request) {
  const { label, body } = await req.json();
  if (!label || !body) return new Response(JSON.stringify({ error: "label & body required" }), { status: 400 });
  const supa = supabaseAdmin();
  const { data, error } = await supa
    .from("quick_replies")
    .insert({ label, body })
    .select("id,label,body")
    .single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ quick_reply: data }), { status: 200 });
}
