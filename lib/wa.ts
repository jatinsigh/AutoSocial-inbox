import type { Secrets } from "@/lib/runtimeConfig";

export async function sendText({to, text }: {to: string; text: string }) {
  if (!process.env.WA_TOKEN || !process.env.WA_PHONE_ID) throw new Error("WhatsApp credentials not configured");
  const url = `https://graph.facebook.com/${process.env.GRAPH_VERSION}/${process.env.WA_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WA_TOKEN}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  const j = await res.json().catch(() => ({}));

  console.log("J >", JSON.stringify(j, null, 2));
  if (!res.ok) throw new Error(j?.error?.message || `WA send failed: ${res.status}`);
  return j;
}

export async function sendTemplate({
  to, template,
}: {
  to: string;
  template: { name: string; language: { code: string }; components?: any[] };
}) {
  if (!process.env.WA_TOKEN || !process.env.WA_PHONE_ID) throw new Error("WhatsApp credentials not configured");
  const url = `https://graph.facebook.com/${process.env.GRAPH_VERSION}/${process.env.WA_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WA_TOKEN}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error?.message || `WA template failed: ${res.status}`);
  return j;
}
