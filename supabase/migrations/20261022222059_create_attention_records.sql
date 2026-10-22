create table public.attentions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default (
    'AT-' || to_char(timezone('America/La_Paz', now()), 'YYYY') || '-' || upper(substr(gen_random_uuid()::text, 1, 8))
  ),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  procedure_type text not null default 'Registro ciudadano'
    check (char_length(btrim(procedure_type)) between 1 and 120),
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  notes text not null default '' check (char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  constraint attentions_id_owner_unique unique (id, owner_id)
);

create index attentions_owner_started_at_idx
  on public.attentions (owner_id, started_at desc);

alter table public.attentions enable row level security;

create policy attentions_select_own
  on public.attentions for select to authenticated
  using (owner_id = (select auth.uid()));

create policy attentions_insert_own
  on public.attentions for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy attentions_update_own
  on public.attentions for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

revoke all on public.attentions from public, anon;
grant select, insert, update on public.attentions to authenticated;

create table public.attention_messages (
  id uuid primary key default gen_random_uuid(),
  attention_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sender text not null check (sender in ('citizen', 'staff')),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  source text not null check (source in ('reviewed-sign', 'typed', 'frequent-phrase', 'dictation', 'demo')),
  state text not null check (state in ('confirmed', 'sent', 'pending')),
  created_at timestamptz not null default now(),
  constraint attention_messages_attention_owner_fkey
    foreign key (attention_id, owner_id)
    references public.attentions (id, owner_id) on delete cascade
);

create index attention_messages_attention_created_at_idx
  on public.attention_messages (attention_id, created_at);

alter table public.attention_messages enable row level security;

create policy attention_messages_select_own
  on public.attention_messages for select to authenticated
  using (owner_id = (select auth.uid()));

create policy attention_messages_insert_own
  on public.attention_messages for insert to authenticated
  with check (owner_id = (select auth.uid()));

revoke all on public.attention_messages from public, anon;
grant select, insert on public.attention_messages to authenticated;

comment on table public.attentions is
  'Atenciones de trámites, privadas para la cuenta de personal que las registra.';
comment on table public.attention_messages is
  'Mensajes revisados de una atención; no guarda imágenes, video ni audio.';
