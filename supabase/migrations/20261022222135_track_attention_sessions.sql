alter table public.attentions
  add column session_started_at timestamptz not null default now();
