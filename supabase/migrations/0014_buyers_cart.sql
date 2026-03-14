create table if not exists public.buyer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.buyer_carts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  buyer_id uuid not null references public.buyer_profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'checked_out')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buyer_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.buyer_carts(id) on delete cascade,
  block_id text not null,
  name text not null,
  price numeric,
  currency text,
  quantity integer not null default 1 check (quantity > 0),
  image_url text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_buyer_cart_active_unique
  on public.buyer_carts (buyer_id, site_id)
  where status = 'active';

create unique index if not exists idx_buyer_cart_items_unique
  on public.buyer_cart_items (cart_id, block_id);

create index if not exists idx_buyer_cart_items_cart_id on public.buyer_cart_items(cart_id);

alter table public.buyer_profiles enable row level security;
alter table public.buyer_carts enable row level security;
alter table public.buyer_cart_items enable row level security;

create policy "buyer_profiles_select_own" on public.buyer_profiles
for select using (auth.uid() = id);

create policy "buyer_carts_select_own" on public.buyer_carts
for select using (buyer_id = auth.uid());

create policy "buyer_carts_insert_own" on public.buyer_carts
for insert with check (buyer_id = auth.uid());

create policy "buyer_carts_update_own" on public.buyer_carts
for update using (buyer_id = auth.uid());

create policy "buyer_carts_delete_own" on public.buyer_carts
for delete using (buyer_id = auth.uid());

create policy "buyer_cart_items_select_own" on public.buyer_cart_items
for select using (
  exists (
    select 1 from public.buyer_carts c
    where c.id = buyer_cart_items.cart_id and c.buyer_id = auth.uid()
  )
);

create policy "buyer_cart_items_insert_own" on public.buyer_cart_items
for insert with check (
  exists (
    select 1 from public.buyer_carts c
    where c.id = buyer_cart_items.cart_id and c.buyer_id = auth.uid()
  )
);

create policy "buyer_cart_items_update_own" on public.buyer_cart_items
for update using (
  exists (
    select 1 from public.buyer_carts c
    where c.id = buyer_cart_items.cart_id and c.buyer_id = auth.uid()
  )
);

create policy "buyer_cart_items_delete_own" on public.buyer_cart_items
for delete using (
  exists (
    select 1 from public.buyer_carts c
    where c.id = buyer_cart_items.cart_id and c.buyer_id = auth.uid()
  )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.raw_user_meta_data->>'user_type') = 'buyer' then
    return new;
  end if;

  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.handle_new_buyer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.raw_user_meta_data->>'user_type') = 'buyer' then
    insert into public.buyer_profiles (id, email)
    values (new.id, coalesce(new.email, ''))
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_profiles on auth.users;
drop trigger if exists on_auth_user_created_buyers on auth.users;

create trigger on_auth_user_created_profiles
after insert on auth.users
for each row execute procedure public.handle_new_user();

create trigger on_auth_user_created_buyers
after insert on auth.users
for each row execute procedure public.handle_new_buyer();

drop trigger if exists trg_buyer_carts_updated_at on public.buyer_carts;
create trigger trg_buyer_carts_updated_at
before update on public.buyer_carts
for each row execute procedure public.set_updated_at();
