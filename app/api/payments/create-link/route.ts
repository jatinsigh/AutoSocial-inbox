import { createPaymentLink } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { amount, description } = await req.json();
  if (!amount) return new Response(JSON.stringify({ error: "amount required" }), { status: 400 });

  try {
    const pl = await createPaymentLink({
      amount: Number(amount),
      description: description || "Payment"
    });
    return new Response(JSON.stringify({ id: pl.id, short_url: pl.short_url, status: pl.status }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
