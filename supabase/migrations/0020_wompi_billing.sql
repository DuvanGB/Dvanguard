create table if not exists public.billing_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_billing_legal_acceptances_user_versions
  on public.billing_legal_acceptances(user_id, terms_version, privacy_version);

create table if not exists public.billing_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'wompi',
  method_type text not null check (method_type in ('card')),
  wompi_payment_source_id bigint not null unique,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  status text not null default 'available',
  is_default boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_payment_methods_user on public.billing_payment_methods(user_id);

create table if not exists public.billing_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'wompi',
  rail text not null check (rail in ('card_subscription', 'manual_term_purchase')),
  payment_method_kind text not null check (payment_method_kind in ('card', 'pse', 'nequi', 'bank_transfer')),
  plan_code text not null default 'pro',
  interval text check (interval in ('month', 'year')),
  term_length_days integer not null default 30,
  status text not null check (status in ('active', 'payment_pending', 'pending_activation', 'payment_failed', 'expired', 'canceled')),
  starts_at timestamptz,
  ends_at timestamptz,
  renews_automatically boolean not null default false,
  payment_method_id uuid references public.billing_payment_methods(id) on delete set null,
  next_charge_at timestamptz,
  switch_to_card_at timestamptz,
  switch_to_card_payment_method_id uuid references public.billing_payment_methods(id) on delete set null,
  reminder_sent_at timestamptz,
  access_state text not null default 'within_limit' check (access_state in ('within_limit', 'grace_period', 'enforcement_applied')),
  grace_until timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_memberships_user on public.billing_memberships(user_id);
create index if not exists idx_billing_memberships_status on public.billing_memberships(status);
create index if not exists idx_billing_memberships_next_charge on public.billing_memberships(next_charge_at);

create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'wompi',
  method text not null check (method in ('card', 'pse', 'nequi', 'bank_transfer')),
  membership_id uuid references public.billing_memberships(id) on delete set null,
  external_transaction_id text unique,
  reference text not null unique,
  status text not null,
  amount_in_cents bigint not null,
  currency text not null default 'COP',
  interval text check (interval in ('month', 'year')),
  checkout_url text,
  approved_at timestamptz,
  paid_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_transactions_user_created_at
  on public.billing_transactions(user_id, created_at desc);

alter table public.billing_legal_acceptances enable row level security;
alter table public.billing_payment_methods enable row level security;
alter table public.billing_memberships enable row level security;
alter table public.billing_transactions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='billing_legal_acceptances' and policyname='billing_legal_acceptances_select_own'
  ) then
    create policy "billing_legal_acceptances_select_own" on public.billing_legal_acceptances
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='billing_payment_methods' and policyname='billing_payment_methods_select_own'
  ) then
    create policy "billing_payment_methods_select_own" on public.billing_payment_methods
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='billing_memberships' and policyname='billing_memberships_select_own'
  ) then
    create policy "billing_memberships_select_own" on public.billing_memberships
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='billing_transactions' and policyname='billing_transactions_select_own'
  ) then
    create policy "billing_transactions_select_own" on public.billing_transactions
      for select using (auth.uid() = user_id);
  end if;
end $$;

drop trigger if exists trg_billing_legal_acceptances_updated_at on public.billing_legal_acceptances;
create trigger trg_billing_legal_acceptances_updated_at
before update on public.billing_legal_acceptances
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_billing_payment_methods_updated_at on public.billing_payment_methods;
create trigger trg_billing_payment_methods_updated_at
before update on public.billing_payment_methods
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_billing_memberships_updated_at on public.billing_memberships;
create trigger trg_billing_memberships_updated_at
before update on public.billing_memberships
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_billing_transactions_updated_at on public.billing_transactions;
create trigger trg_billing_transactions_updated_at
before update on public.billing_transactions
for each row execute procedure public.set_updated_at();
