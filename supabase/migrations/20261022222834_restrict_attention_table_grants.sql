revoke all on public.attentions from authenticated;
grant select, insert, update on public.attentions to authenticated;

revoke all on public.attention_messages from authenticated;
grant select, insert on public.attention_messages to authenticated;
