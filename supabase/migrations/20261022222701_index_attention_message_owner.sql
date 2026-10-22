alter table public.attention_messages
  drop constraint attention_messages_owner_id_fkey;

create index attention_messages_attention_owner_idx
  on public.attention_messages (attention_id, owner_id);
