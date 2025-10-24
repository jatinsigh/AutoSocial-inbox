import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function requireUser(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return { user: null, error: "missing bearer token" } as const;
  }
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return { user: null, error: "invalid token" } as const;
    return { user: data.user, error: null } as const;
  } catch (e: any) {
    return { user: null, error: e?.message || "auth error" } as const;
  }
}
