export type WASendText = {
  to: string;
  text: string;
};

export type WASendTemplate = {
  to: string;
  template: {
    name: string;
    language: { code: string };
    components?: any[];
  };
};

const GRAPH_VERSION = process.env.GRAPH_VERSION || "v20.0";
const WA_TOKEN = process.env.WA_TOKEN!;
const WA_PHONE_ID = process.env.WA_PHONE_ID!;

async function postWA(body: any) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${WA_TOKEN}`
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      ...body
    })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`WA send failed: ${res.status} ${t}`);
  }
  return res.json();
}

export async function sendText({ to, text }: WASendText) {
  return postWA({ to, type: "text", text: { body: text } });
}

export async function sendTemplate({ to, template }: WASendTemplate) {
  return postWA({ to, type: "template", template });
}
