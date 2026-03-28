create table if not exists public.billing_customers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text not null unique,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  stripe_product_id text,
  plan_code text not null references public.plan_definitions(code),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  status text not null,
  access_state text not null default 'within_limit' check (access_state in ('within_limit', 'grace_period', 'enforcement_applied')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  grace_until timestamptz,
  pending_interval text check (pending_interval in ('month', 'year')),
  default_payment_method_brand text,
  default_payment_method_last4 text,
  default_payment_method_exp_month integer,
  default_payment_method_exp_year integer,
  latest_invoice_id text,
  last_event_id text,
  last_event_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_invoice_id text not null unique,
  stripe_subscription_id text,
  status text not null,
  currency text,
  amount_due bigint not null default 0,
  amount_paid bigint not null default 0,
  hosted_invoice_url text,
  invoice_pdf text,
  period_start timestamptz,
  period_end timestamptz,
  due_date timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_customers_stripe_customer on public.billing_customers(stripe_customer_id);
create index if not exists idx_billing_subscriptions_status on public.billing_subscriptions(status);
create index if not exists idx_billing_subscriptions_access_state on public.billing_subscriptions(access_state);
create index if not exists idx_billing_subscriptions_grace_until on public.billing_subscriptions(grace_until);
create index if not exists idx_billing_invoices_user_created_at on public.billing_invoices(user_id, created_at desc);
create index if not exists idx_billing_invoices_subscription on public.billing_invoices(stripe_subscription_id);

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_invoices enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='billing_customers' and policyname='billing_customers_select_own'
  ) then
    create policy "billing_customers_select_own" on public.billing_customers
      for select using (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='billing_subscriptions' and policyname='billing_subscriptions_select_own'
  ) then
    create policy "billing_subscriptions_select_own" on public.billing_subscriptions
      for select using (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='billing_invoices' and policyname='billing_invoices_select_own'
  ) then
    create policy "billing_invoices_select_own" on public.billing_invoices
      for select using (user_id = auth.uid());
  end if;
end $$;

drop trigger if exists trg_billing_customers_updated_at on public.billing_customers;
create trigger trg_billing_customers_updated_at
before update on public.billing_customers
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_billing_subscriptions_updated_at on public.billing_subscriptions;
create trigger trg_billing_subscriptions_updated_at
before update on public.billing_subscriptions
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_billing_invoices_updated_at on public.billing_invoices;
create trigger trg_billing_invoices_updated_at
before update on public.billing_invoices
for each row execute procedure public.set_updated_at();
