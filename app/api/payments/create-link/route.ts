import { requireUser } from "@/lib/authServer";
import { getSecretsForUser } from "@/lib/runtimeConfig";
import { createPaymentLink } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, error } = await requireUser(req);
  if (!user) return new Response(JSON.stringify({ error: error || "unauthorized" }), { status: 401 });

  const { amount, description, notes } = await req.json();
  const cfg = await getSecretsForUser(user.id);

  try {
    const link = await createPaymentLink({ cfg, amount, description, notes });
    return new Response(JSON.stringify(link), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
