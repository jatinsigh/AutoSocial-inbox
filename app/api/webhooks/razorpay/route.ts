import crypto from "crypto";
import { readRawBody } from "@/lib/rawBody";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await readRawBody(req);
  const signature = req.headers.get("x-razorpay-signature") || "";
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(raw)
    .digest("hex");

  if (signature !== expected) {
    return new Response("bad sig", { status: 400 });
  }

  const payload = JSON.parse(raw.toString("utf8"));
  const event = payload?.event;
  const supa = supabaseAdmin();

  if (event === "payment_link.paid") {
    const plinkId = payload?.payload?.payment_link?.entity?.id;
    const payment = payload?.payload?.payment?.entity;
    const amount = payment?.amount;
    const currency = payment?.currency;

    // Mark payment as paid (MVP assumes we created a row earlier if needed)
    await supa.from("payments").upsert({
      id: plinkId,
      provider: "razorpay",
      link_id: plinkId,
      amount,
      currency,
      status: "paid",
      created_at: new Date().toISOString()
    }, { onConflict: "id" });

    // TODO: Find conversation/contact via notes/reference and send WA confirmation
  }

  return new Response("ok");
}
