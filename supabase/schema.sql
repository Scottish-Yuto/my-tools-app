-- ユーザーごとのアプリデータを保存するテーブル
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tasks jsonb not null default '[]'::jsonb,
  memos jsonb not null default '[]'::jsonb,
  shortcuts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "Users can read their own data"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "Users can create their own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);