# AutoSocial Inbox — MVP skeleton (Next.js + WhatsApp + Razorpay + Supabase)

A minimal, ready-to-run scaffold for a WhatsApp-first inbox with Razorpay payment links and Supabase storage.

## Quick start
```bash
# 1) Create env
cp .env.example .env.local
# Fill the variables for WhatsApp, Razorpay, Supabase

# 2) Install & run
npm install
npm run dev
```

### WhatsApp setup
- Create a WA app in Meta, add a Business Phone Number.
- Set **Webhook callback URL** to: `https://YOUR_DOMAIN/api/webhooks/whatsapp`
- Verify with `WHATSAPP_VERIFY_TOKEN`.
- Subscribe to `messages` and `message_status`.

### Razorpay setup
- Create/Use account, enable **Payment Links**.
- Set webhook to: `https://YOUR_DOMAIN/api/webhooks/razorpay`
- Choose event: `payment_link.paid`
- Use `RAZORPAY_WEBHOOK_SECRET` to verify the signature.

### Supabase
- Create a new project.
- Run `supabase.sql` to create tables and policies (SQL provided in `supabase/supabase.sql`).

---

## Included API routes
- `GET /api/webhooks/whatsapp` — webhook verification (echo hub.challenge)
- `POST /api/webhooks/whatsapp` — receive inbound messages/status updates
- `POST /api/webhooks/razorpay` — receive payment_link.paid webhooks
- `POST /api/wa/send` — send a text or template message (server-side helper)
- `POST /api/payments/create-link` — create a Razorpay Payment Link

> All server routes run on the Node.js runtime and use `SUPABASE_SERVICE_ROLE` to write data.

---

## Minimal UI
Home page shows a very small Inbox placeholder and a test form to create a Payment Link and send it to a number via WhatsApp.

---

## Notes
- Use **session messages** only within the 24-hour window; otherwise send **approved templates**.
- Razorpay amounts are in **paise** (₹499 = 49900).
- Do NOT expose `SUPABASE_SERVICE_ROLE` on the client. It's only used on the server (API routes).
