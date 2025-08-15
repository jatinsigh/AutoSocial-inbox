-- AutoSocial Inbox — Supabase schema (MVP)
-- Run this in the SQL editor of your Supabase project.

create table if not exists contacts (
  wa_id text primary key,
  name text,
  phone text,
  tags jsonb default '{}'::jsonb
);

create table if not exists conversations (
  id uuid primary key,
  contact_id text references contacts(wa_id) on delete cascade,
  status text default 'open', -- open|closed|paid
  assignee_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists messages (
  id text primary key, -- using WA message id
  conversation_id uuid references conversations(id) on delete cascade,
  direction text not null, -- in|out
  type text,              -- text|image|audio|template
  text text,
  media_url text,
  wa_message_id text,
  status text,            -- received|sent|delivered|read|failed
  sent_at timestamptz,
  received_at timestamptz
);

create table if not exists payments (
  id text primary key,         -- plink id (or provider id)
  provider text not null,      -- razorpay|stripe
  link_id text,
  contact_id text,
  amount bigint,
  currency text,
  status text,                 -- created|paid|failed
  created_at timestamptz default now()
);

-- RLS
alter table contacts enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table payments enable row level security;

-- Simple permissive policies for MVP (do not use in production as-is)
create policy "allow read to anon" on contacts for select using (true);
create policy "allow write to service role" on contacts for all to authenticated using (true) with check (true);

create policy "allow read to anon" on conversations for select using (true);
create policy "allow write to service role" on conversations for all to authenticated using (true) with check (true);

create policy "allow read to anon" on messages for select using (true);
create policy "allow write to service role" on messages for all to authenticated using (true) with check (true);

create policy "allow read to anon" on payments for select using (true);
create policy "allow write to service role" on payments for all to authenticated using (true) with check (true);
