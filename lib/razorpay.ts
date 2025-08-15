const RZP_BASE = "https://api.razorpay.com/v1";

function basicAuth() {
  const id = process.env.RAZORPAY_KEY_ID!;
  const secret = process.env.RAZORPAY_KEY_SECRET!;
  const token = Buffer.from(`${id}:${secret}`).toString("base64");
  return `Basic ${token}`;
}

export async function createPaymentLink(params: {
  amount: number;
  currency?: string;
  description?: string;
  reference_id?: string;
  customer?: { name?: string; email?: string; contact?: string };
  expire_by?: number;
  notes?: Record<string, string>;
}) {
  const res = await fetch(`${RZP_BASE}/payment_links`, {
    method: "POST",
    headers: {
      "Authorization": basicAuth(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      currency: "INR",
      notify: { sms: true, email: true },
      callback_method: "get",
      ...params
    })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Razorpay create link failed: ${res.status} ${t}`);
  }
  return res.json();
}
