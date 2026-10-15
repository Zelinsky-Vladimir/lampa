create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text        not null check (kind in ('lib', 'mark', 'shelf')),
  id         text        not null check (char_length(id) <= 600),
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at bigint      not null,
  device     text,
  server_at  timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, id)
);

create index if not exists records_pull on public.records (user_id, server_at);

alter table public.records enable row level security;

drop policy if exists "records: only own" on public.records;
create policy "records: only own" on public.records
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.records_before_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at <= old.updated_at then
    return null;
  end if;
  new.server_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_before_write on public.records;
create trigger records_before_write
  before insert or update on public.records
  for each row execute function public.records_before_write();

insert into storage.buckets (id, name, public, file_size_limit)
values ('books', 'books', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "books: read own" on storage.objects;
create policy "books: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "books: upload own" on storage.objects;
create policy "books: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "books: replace own" on storage.objects;
create policy "books: replace own" on storage.objects
  for update to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "books: delete own" on storage.objects;
create policy "books: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.delete_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

create table if not exists public.book_files (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  hash       text        not null check (hash ~ '^[0-9a-f]{16}$'),
  ext        text        not null check (ext in ('fb2', 'epub', 'txt', 'zip')),
  size       bigint      not null check (size > 0),
  ready      boolean     not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, hash)
);

alter table public.book_files enable row level security;

drop policy if exists "book_files: read own" on public.book_files;
create policy "book_files: read own" on public.book_files
  for select to authenticated
  using (auth.uid() = user_id);

create table if not exists public.book_quotas (
  user_id  uuid    primary key references auth.users (id) on delete cascade,
  quota_mb integer not null check (quota_mb > 0)
);

alter table public.book_quotas enable row level security;
