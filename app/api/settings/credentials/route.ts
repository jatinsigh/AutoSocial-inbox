import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mask, seal, open } from "@/lib/crypto";
import { requireUser } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { user, error } = await requireUser(req);
  if (!user) return new Response(JSON.stringify({ error: error || "unauthorized" }), { status: 401 });

  const supa = supabaseAdmin();
  const { data } = await supa
    .from("integration_secrets_accounts")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const resp = {
    whatsapp: {
      phone_id_masked: mask(open(data?.wa_phone_id_enc)),
      graph_version: data?.graph_version || "v20.0",
      token_masked: mask(open(data?.wa_token_enc)),
    },
    razorpay: {
      key_id_masked: mask(open(data?.razorpay_key_id_enc)),
      key_secret_masked: mask(open(data?.razorpay_key_secret_enc)),
      webhook_secret_masked: mask(open(data?.razorpay_webhook_secret_enc)),
    },
  };
  return new Response(JSON.stringify(resp), { status: 200 });
}

export async function POST(req: Request) {
  const { user, error } = await requireUser(req);
  if (!user) return new Response(JSON.stringify({ error: error || "unauthorized" }), { status: 401 });

  const payload = await req.json().catch(() => ({}));
  const {
    wa_phone_id, wa_token, graph_version,
    razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret,
  } = payload || {};

  const updates: any = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };
  if (graph_version?.trim()) updates.graph_version = graph_version.trim();
  if (wa_phone_id?.trim()) updates.wa_phone_id_enc = seal(wa_phone_id.trim());
  if (wa_token?.trim()) updates.wa_token_enc = seal(wa_token.trim());
  if (razorpay_key_id?.trim()) updates.razorpay_key_id_enc = seal(razorpay_key_id.trim());
  if (razorpay_key_secret?.trim()) updates.razorpay_key_secret_enc = seal(razorpay_key_secret.trim());
  if (razorpay_webhook_secret?.trim()) updates.razorpay_webhook_secret_enc = seal(razorpay_webhook_secret.trim());

  const supa = supabaseAdmin();
  const { error: upsertErr } = await supa
    .from("integration_secrets_accounts")
    .upsert(updates, { onConflict: "user_id" });

  if (upsertErr) return new Response(JSON.stringify({ error: upsertErr.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
