import type { Secrets } from "@/lib/runtimeConfig";

export async function createPaymentLink({
  cfg, amount, description, notes,
}: {
  cfg: Secrets;
  amount: number;
  description?: string;
  notes?: Record<string, string>;
}) {
  if (!cfg.RAZORPAY_KEY_ID || !cfg.RAZORPAY_KEY_SECRET) throw new Error("Razorpay credentials not configured");
  const basic = Buffer.from(`${cfg.RAZORPAY_KEY_ID}:${cfg.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount, currency: "INR",
      description: description || "Payment",
      notes: notes || {},
      remind_enable: true,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error?.description || `Razorpay error: ${res.status}`);
  return j;
}
