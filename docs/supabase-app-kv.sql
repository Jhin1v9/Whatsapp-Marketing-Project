-- Execute no SQL Editor do Supabase (uma vez).
-- Tabela KV usada pelo app web para persistir runtime e preferencias.

create table if not exists public.app_kv (
  namespace text not null,
  item_key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_kv_pkey primary key (namespace, item_key)
);

create index if not exists app_kv_updated_at_idx on public.app_kv (updated_at desc);

-- Como o app escreve com service role key, a RLS pode ficar desabilitada.
alter table public.app_kv disable row level security;
