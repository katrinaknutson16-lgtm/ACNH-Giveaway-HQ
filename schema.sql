-- Run in Supabase SQL Editor. Row-level security isolates each user's data.
create table if not exists public.groups (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, color text not null default '#4e8ed5', created_at timestamptz not null default now());
create table if not exists public.giveaways (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 group_id uuid not null references public.groups(id) on delete cascade,
 title text not null, closes_at timestamptz not null, posted_at timestamptz,
 prize text not null default '', status text not null default 'open' check (status in ('open','draw','announce','done')),
 winner text not null default '', created_at timestamptz not null default now());
create index if not exists groups_user_idx on public.groups(user_id);
create index if not exists giveaways_user_close_idx on public.giveaways(user_id,closes_at);
alter table public.groups enable row level security;
alter table public.giveaways enable row level security;
drop policy if exists "Own groups" on public.groups;
create policy "Own groups" on public.groups for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Own giveaways" on public.giveaways;
create policy "Own giveaways" on public.giveaways for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
-- A giveaway must reference a group belonging to the same account.
create or replace function public.check_giveaway_group_owner() returns trigger language plpgsql set search_path = '' as $$
begin
 if not exists(select 1 from public.groups g where g.id=new.group_id and g.user_id=new.user_id) then
  raise exception 'Group does not belong to this account';
 end if;
 return new;
end; $$;
drop trigger if exists giveaway_group_owner on public.giveaways;
create trigger giveaway_group_owner before insert or update on public.giveaways for each row execute function public.check_giveaway_group_owner();
-- Realtime updates for signed-in devices; RLS still applies.
do $$ begin alter publication supabase_realtime add table public.groups; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.giveaways; exception when duplicate_object then null; end $$;
