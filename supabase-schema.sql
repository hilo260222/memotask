-- MemoTask sync schema for Supabase.
-- Run this in the Supabase SQL editor for the project you want to use.
-- This schema does not define any DELETE policy.

create table if not exists public.memotask_documents (
  user_id uuid not null references auth.users(id),
  doc_id text not null default 'default',
  payload jsonb not null,
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, doc_id)
);

alter table public.memotask_documents enable row level security;

create policy "memotask_select_own_document"
on public.memotask_documents
for select
to authenticated
using (auth.uid() = user_id);

create policy "memotask_insert_own_document"
on public.memotask_documents
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "memotask_update_own_document"
on public.memotask_documents
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
