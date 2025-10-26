import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function createSignedUrlFor(bucket: string, path: string, expiresSec = 3600) {
  const supa = supabaseAdmin();
  const { data, error } = await supa.storage.from(bucket).createSignedUrl(path, expiresSec);
  if (error) throw error;
  return data.signedUrl as string;
}
