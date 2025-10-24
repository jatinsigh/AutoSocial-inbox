import crypto from "crypto";
import { readRawBody } from "@/lib/rawBody";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendText } from "@/lib/wa"; 
import { getSecrets } from "@/lib/runtimeConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await readRawBody(req);
    const { RAZORPAY_WEBHOOK_SECRET } = await getSecrets();
  if (!RAZORPAY_WEBHOOK_SECRET) return new Response("no secret", { status: 400 });

  const signature = req.headers.get("x-razorpay-signature") || "";
  const expected = crypto.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex");
  if (signature !== expected) return new Response("bad sig", { status: 400 });

  const payload = JSON.parse(raw.toString("utf8"));
  const event = payload?.event;
  const supa = supabaseAdmin();

  if (event === "payment_link.paid") {
    const plink = payload?.payload?.payment_link?.entity;
const pay   = payload?.payload?.payment?.entity;
const notes = plink?.notes || {};
const contact_wa_id   = notes?.contact_wa_id || null;
const conversation_id = notes?.conversation_id || null;

await supa.from("payments").upsert({
  id: plink?.id, provider: "razorpay", link_id: plink?.id,
  contact_id: contact_wa_id, amount: pay?.amount, currency: pay?.currency,
  status: "paid", created_at: new Date().toISOString()
}, { onConflict: "id" });

if (conversation_id) {
  await supa.from("conversations")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", conversation_id);
}
if (contact_wa_id) {
  await sendText({ to: contact_wa_id, text: "Paid ✅ Thanks! Your spot is confirmed. 🎉" });
}

  }

  return new Response("ok");
}
