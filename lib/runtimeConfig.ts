import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { open } from "@/lib/crypto";

export type Secrets = {
  WA_PHONE_ID: string | null;
  WA_TOKEN: string | null;
  GRAPH_VERSION: string;
  RAZORPAY_KEY_ID: string | null;
  RAZORPAY_KEY_SECRET: string | null;
  RAZORPAY_WEBHOOK_SECRET: string | null;
};

const cache = new Map<string, { at: number; val: Secrets }>();

export async function getSecretsForUser(userId?: string | null): Promise<Secrets> {
  // If .env has full creds, allow local single-tenant dev to keep working
  const env: Secrets = {
    WA_PHONE_ID: process.env.WA_PHONE_ID || null,
    WA_TOKEN: process.env.WA_TOKEN || null,
    GRAPH_VERSION: process.env.GRAPH_VERSION || "v20.0",
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || null,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || null,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || null,
  };
  const envComplete = !!(env.WA_TOKEN && env.WA_PHONE_ID && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

  // When no user provided, just return env (used for public status)
  if (!userId) return envComplete ? env : { ...env, WA_TOKEN: null, WA_PHONE_ID: null, RAZORPAY_KEY_ID: null, RAZORPAY_KEY_SECRET: null };

  const key = `u:${userId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.val;

  const supa = supabaseAdmin();
  const { data } = await supa
    .from("integration_secrets_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const out: Secrets = {
    WA_PHONE_ID: open(data?.wa_phone_id_enc) || (envComplete ? env.WA_PHONE_ID : null),
    WA_TOKEN: open(data?.wa_token_enc) || (envComplete ? env.WA_TOKEN : null),
    GRAPH_VERSION: data?.graph_version || env.GRAPH_VERSION || "v20.0",
    RAZORPAY_KEY_ID: open(data?.razorpay_key_id_enc) || (envComplete ? env.RAZORPAY_KEY_ID : null),
    RAZORPAY_KEY_SECRET: open(data?.razorpay_key_secret_enc) || (envComplete ? env.RAZORPAY_KEY_SECRET : null),
    RAZORPAY_WEBHOOK_SECRET: open(data?.razorpay_webhook_secret_enc) || (envComplete ? env.RAZORPAY_WEBHOOK_SECRET : null),
  };

  cache.set(key, { at: Date.now(), val: out });
  return out;
}
