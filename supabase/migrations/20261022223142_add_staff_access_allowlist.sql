create table public.staff_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.staff_access enable row level security;
revoke all on public.staff_access from public, anon, authenticated;
grant select on public.staff_access to authenticated;

create policy staff_access_select_self
  on public.staff_access for select to authenticated
  using (user_id = (select auth.uid()));

drop policy attentions_select_own on public.attentions;
create policy attentions_select_own
  on public.attentions for select to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.staff_access
      where user_id = (select auth.uid()) and is_active
    )
  );

drop policy attentions_insert_own on public.attentions;
create policy attentions_insert_own
  on public.attentions for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.staff_access
      where user_id = (select auth.uid()) and is_active
    )
  );

drop policy attentions_update_own on public.attentions;
create policy attentions_update_own
  on public.attentions for update to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.staff_access
      where user_id = (select auth.uid()) and is_active
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.staff_access
      where user_id = (select auth.uid()) and is_active
    )
  );

drop policy attention_messages_select_own on public.attention_messages;
create policy attention_messages_select_own
  on public.attention_messages for select to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.staff_access
      where user_id = (select auth.uid()) and is_active
    )
  );

drop policy attention_messages_insert_own on public.attention_messages;
create policy attention_messages_insert_own
  on public.attention_messages for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.staff_access
      where user_id = (select auth.uid()) and is_active
    )
  );
