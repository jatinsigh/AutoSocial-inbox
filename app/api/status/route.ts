import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSecretsForUser } from "@/lib/runtimeConfig";
import { requireUser } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function jsonIfPossible(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) { try { return await res.json(); } catch {} }
  return null;
}

export async function GET(req: Request) {
  const { user } = await requireUser(req); // optional
  // const process.env = await getSecretsForUser(user?.id || null);

  const env = {
    WA_TOKEN: !!process.env.WA_TOKEN,
    WA_PHONE_ID: !!process.env.WA_PHONE_ID,
    GRAPH_VERSION: !!process.env.GRAPH_VERSION,
    RAZORPAY_KEY_ID: !!process.env.RAZORPAY_KEY_ID,
    RAZORPAY_WEBHOOK_SECRET: !!process.env.RAZORPAY_WEBHOOK_SECRET,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || null,
  };

  const out: any = {
    env, supabase_ok: false, wa_graph_ok: false, wa_display_phone: null, razorpay_auth_ok: false, errors: [] as string[],
  };

  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE) {
    try {
      const supa = supabaseAdmin();
      await supa.from("contacts").select("wa_id").limit(1);
      out.supabase_ok = true;
    } catch (e: any) { out.errors.push(`supabase: ${e?.message || "query failed"}`); }
  }

  if (process.env.WA_TOKEN && process.env.WA_PHONE_ID && process.env.GRAPH_VERSION) {
    try {
      const url = `https://graph.facebook.com/${process.env.GRAPH_VERSION}/${process.env.WA_PHONE_ID}?fields=id,display_phone_number`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` } });
      if (r.ok) {
        const j = await jsonIfPossible(r);
        out.wa_graph_ok = true; out.wa_display_phone = j?.display_phone_number ?? null;
      } else out.errors.push(`wa_graph: HTTP ${r.status}`);
    } catch (e: any) { out.errors.push(`wa_graph: ${e?.message || "fetch failed"}`); }
  }

  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    try {
      const basic = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
      const r = await fetch("https://api.razorpay.com/v1/payments?count=1", { headers: { Authorization: `Basic ${basic}` }});
      out.razorpay_auth_ok = r.status === 200;
      if (!out.razorpay_auth_ok) out.errors.push(`razorpay: HTTP ${r.status}`);
    } catch (e: any) { out.errors.push(`razorpay: ${e?.message || "fetch failed"}`); }
  }

  return new Response(JSON.stringify(out), { status: 200, headers: { "content-type": "application/json" } });
}
