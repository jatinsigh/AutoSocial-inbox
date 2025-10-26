import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const BUCKET = "attachments";

type DBMessage = {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  type: string | null;
  text: string | null;
  status: string | null;
  sent_at: string | null;
  received_at: string | null;
};

type DBAttachment = {
  message_id: string;
  storage_path: string;
  mime_type: string;
  file_name: string | null;
};

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supa = supabaseAdmin();

  // 1) fetch all (we’ll sort in memory by unified ts)
  const { data: msgs, error: msgErr } = await supa
    .from("messages")
    .select("id, conversation_id, direction, type, text, status, sent_at, received_at")
    .eq("conversation_id", params.id);

  console.log("Messages fetched:", msgs?.length || 0);

  if (msgErr) {
    return new Response(JSON.stringify({ error: msgErr.message }), {
      status: 500,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  }
  const list = (msgs || []) as DBMessage[];

  if (list.length === 0) {
    return new Response(JSON.stringify({ messages: [] }), {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  }

  console.log("Messages fetched:", list.length);

  // 2) sort by unified timeline: ts = received_at || sent_at
  const withTs = list.map((m) => {
    const ts = m.received_at ?? m.sent_at ?? new Date(0).toISOString();
    return { ...m, __ts: new Date(ts).getTime() };
  });
  withTs.sort((a, b) => a.__ts - b.__ts);

  // 3) load attachments for media messages
  const mediaIds = withTs
    .filter((m) => m.type === "image" || m.type === "document" || m.type === "video" || m.type === "audio")
    .map((m) => m.id);

  let attMap = new Map<string, DBAttachment>();
  if (mediaIds.length) {
    const { data: atts, error: attErr } = await supa
      .from("attachments")
      .select("message_id, storage_path, mime_type, file_name")
      .in("message_id", mediaIds);

    if (attErr) {
      return new Response(JSON.stringify({ error: attErr.message }), {
        status: 500,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }
    for (const a of (atts || []) as DBAttachment[]) {
      attMap.set(a.message_id, a);
    }
  }

  // 4) sign URLs where applicable
  const signedUrlMap = new Map<string, { url: string; mime_type: string; file_name: string | null }>();
  await Promise.all(
    Array.from(attMap.values()).map(async (a) => {
      const { data: signed, error: signErr } = await supa.storage
        .from(BUCKET)
        .createSignedUrl(a.storage_path, 600); // 10 minutes
      if (!signErr && signed?.signedUrl) {
        signedUrlMap.set(a.message_id, {
          url: signed.signedUrl,
          mime_type: a.mime_type,
          file_name: a.file_name ?? null,
        });
      }
    })
  );

  // 5) merge + return
  const enriched = withTs.map(({ __ts, ...m }) => {
    const att = signedUrlMap.get(m.id);
    return att ? { ...m, attachment: att } : m;
  });

  return new Response(JSON.stringify({ messages: enriched }), {
    status: 200,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
