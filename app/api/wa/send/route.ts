import { sendText, sendTemplate } from "@/lib/wa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();

  const { to, kind, text, template } = body;
  console.log("WA WEBHOOK >", JSON.stringify(body, null, 2)); // ✅ add this
  if (!to) return new Response(JSON.stringify({ error: "Missing 'to'" }), { status: 400 });

  try {
    let result;
    if (kind === "template") {
      if (!template) throw new Error("Missing template");
      result = await sendTemplate({ to, template });
    } else {
      result = await sendText({ to, text: text || "Hello!" });
    }
    const id = result?.messages?.[0]?.id;
    return new Response(JSON.stringify({ id, result }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
