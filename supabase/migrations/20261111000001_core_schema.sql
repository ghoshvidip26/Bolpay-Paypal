-- BolPay core schema: businesses, members (RBAC), workers, attendance,
-- incentive rules, payouts, transactions, voice logs. All tables use RLS.
-- Roles: owner (everything), supervisor (attendance only), worker (own data, read-only).

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------- tables

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'USD',
  -- Pay periods are fixed-length windows counted from this date.
  period_anchor date not null default current_date,
  period_length_days int not null default 14 check (period_length_days between 1 and 31),
  created_at timestamptz not null default now()
);

create table public.members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'supervisor', 'worker')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index members_user_id_idx on public.members (user_id);

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- Set when the worker has their own login.
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  job_role text not null default '',
  phone text not null default '',
  payout_email text not null default '',
  daily_wage numeric(10, 2) not null check (daily_wage >= 0),
  joined_on date not null default current_date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (id, business_id)
);
create index workers_business_id_idx on public.workers (business_id);
create index workers_user_id_idx on public.workers (user_id) where user_id is not null;

create table public.attendance (
  id bigint generated always as identity primary key,
  business_id uuid not null,
  worker_id uuid not null,
  date date not null,
  status text not null check (status in ('present', 'half', 'absent', 'leave')),
  overtime_hours numeric(4, 1) not null default 0 check (overtime_hours between 0 and 24),
  units int not null default 0 check (units >= 0),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (worker_id, date),
  -- Composite FK guarantees the row's business matches the worker's business.
  foreign key (worker_id, business_id) references public.workers(id, business_id) on delete cascade
);
create index attendance_business_date_idx on public.attendance (business_id, date);
create index attendance_updated_by_idx on public.attendance (updated_by);

create table public.incentive_rules (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  working_hours_per_day numeric(4, 1) not null default 8 check (working_hours_per_day > 0),
  overtime_multiplier numeric(4, 2) not null default 1.5 check (overtime_multiplier >= 1),
  daily_unit_target int not null default 20 check (daily_unit_target >= 0),
  rate_per_extra_unit numeric(10, 2) not null default 0.75 check (rate_per_extra_unit >= 0),
  attendance_threshold numeric(3, 2) not null default 0.9 check (attendance_threshold between 0 and 1),
  attendance_bonus numeric(10, 2) not null default 25 check (attendance_bonus >= 0),
  updated_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  worker_id uuid not null,
  period_id text not null,
  period_label text not null,
  period_start date not null,
  period_end date not null,
  breakdown jsonb not null,
  amount numeric(10, 2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references auth.users(id) on delete set null default auth.uid(),
  submitted_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  unique (worker_id, period_id),
  unique (id, business_id),
  foreign key (worker_id, business_id) references public.workers(id, business_id) on delete cascade
);
create index payouts_business_status_idx on public.payouts (business_id, status);
create index payouts_submitted_by_idx on public.payouts (submitted_by);
create index payouts_decided_by_idx on public.payouts (decided_by);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  payout_id uuid not null,
  worker_id uuid not null,
  period_label text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  reference text not null default '',
  failure_reason text,
  paypal_batch_id text,
  paypal_item_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (payout_id, business_id) references public.payouts(id, business_id) on delete cascade,
  foreign key (worker_id, business_id) references public.workers(id, business_id) on delete cascade
);
create index transactions_business_created_idx on public.transactions (business_id, created_at desc);
create index transactions_payout_id_idx on public.transactions (payout_id);
create index transactions_worker_id_idx on public.transactions (worker_id);

create table public.voice_logs (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  transcript text not null,
  intent jsonb,
  result text,
  created_at timestamptz not null default now()
);
create index voice_logs_business_created_idx on public.voice_logs (business_id, created_at desc);
create index voice_logs_user_id_idx on public.voice_logs (user_id);

-- ------------------------------------------------------- RLS helper functions
-- SECURITY DEFINER so policies can read `members`/`workers` without recursive
-- RLS checks. They live in the unexposed `private` schema and only ever answer
-- questions about the calling user (auth.uid()).

create or replace function private.has_role(p_business_id uuid, p_roles text[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

create or replace function private.is_my_worker(p_worker_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workers w
    where w.id = p_worker_id and w.user_id = (select auth.uid())
  );
$$;

revoke all on function private.has_role(uuid, text[]) from public;
revoke all on function private.is_my_worker(uuid) from public;
grant execute on function private.has_role(uuid, text[]) to authenticated;
grant execute on function private.is_my_worker(uuid) to authenticated;

-- ------------------------------------------------------------ enable RLS

alter table public.businesses enable row level security;
alter table public.members enable row level security;
alter table public.workers enable row level security;
alter table public.attendance enable row level security;
alter table public.incentive_rules enable row level security;
alter table public.payouts enable row level security;
alter table public.transactions enable row level security;
alter table public.voice_logs enable row level security;

-- --------------------------------------------------------------- policies

-- businesses
create policy "members read their business" on public.businesses
  for select to authenticated
  using ((select private.has_role(id, array['owner', 'supervisor', 'worker'])));
create policy "owners update their business" on public.businesses
  for update to authenticated
  using ((select private.has_role(id, array['owner'])))
  with check ((select private.has_role(id, array['owner'])));

-- members (managed by owners via SQL/admin for now; users can see their own)
create policy "users read own memberships" on public.members
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role(business_id, array['owner'])));

-- workers
create policy "staff read workers; workers read self" on public.workers
  for select to authenticated
  using (
    (select private.has_role(business_id, array['owner', 'supervisor']))
    or user_id = (select auth.uid())
  );
create policy "owners add workers" on public.workers
  for insert to authenticated
  with check ((select private.has_role(business_id, array['owner'])));
create policy "owners edit workers" on public.workers
  for update to authenticated
  using ((select private.has_role(business_id, array['owner'])))
  with check ((select private.has_role(business_id, array['owner'])));

-- attendance
create policy "staff read attendance; workers read own" on public.attendance
  for select to authenticated
  using (
    (select private.has_role(business_id, array['owner', 'supervisor']))
    or (select private.is_my_worker(worker_id))
  );
create policy "staff mark attendance" on public.attendance
  for insert to authenticated
  with check ((select private.has_role(business_id, array['owner', 'supervisor'])));
create policy "staff edit attendance" on public.attendance
  for update to authenticated
  using ((select private.has_role(business_id, array['owner', 'supervisor'])))
  with check ((select private.has_role(business_id, array['owner', 'supervisor'])));
create policy "staff delete attendance" on public.attendance
  for delete to authenticated
  using ((select private.has_role(business_id, array['owner', 'supervisor'])));

-- incentive rules
create policy "members read rules" on public.incentive_rules
  for select to authenticated
  using ((select private.has_role(business_id, array['owner', 'supervisor', 'worker'])));
create policy "owners edit rules" on public.incentive_rules
  for update to authenticated
  using ((select private.has_role(business_id, array['owner'])))
  with check ((select private.has_role(business_id, array['owner'])));

-- payouts: supervisors can see them; only owners submit and decide.
create policy "staff read payouts; workers read own" on public.payouts
  for select to authenticated
  using (
    (select private.has_role(business_id, array['owner', 'supervisor']))
    or (select private.is_my_worker(worker_id))
  );
create policy "owners submit payouts" on public.payouts
  for insert to authenticated
  with check (status = 'pending' and (select private.has_role(business_id, array['owner'])));
create policy "owners decide payouts" on public.payouts
  for update to authenticated
  using ((select private.has_role(business_id, array['owner'])))
  with check ((select private.has_role(business_id, array['owner'])));

-- transactions: owners only write (real PayPal calls happen server-side).
create policy "owners read transactions; workers read own" on public.transactions
  for select to authenticated
  using (
    (select private.has_role(business_id, array['owner']))
    or (select private.is_my_worker(worker_id))
  );
create policy "owners create transactions" on public.transactions
  for insert to authenticated
  with check ((select private.has_role(business_id, array['owner'])));
create policy "owners update transactions" on public.transactions
  for update to authenticated
  using ((select private.has_role(business_id, array['owner'])))
  with check ((select private.has_role(business_id, array['owner'])));

-- voice logs: audit trail. Staff write their own; owners read all.
create policy "owners read all voice logs; users read own" on public.voice_logs
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_role(business_id, array['owner']))
  );
create policy "staff write own voice logs" on public.voice_logs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.has_role(business_id, array['owner', 'supervisor']))
  );

-- ------------------------------------------------------- Data API grants
-- Nothing is reachable by anonymous visitors. Signed-in users get table
-- privileges; RLS above decides which rows.

revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.businesses to authenticated;
grant select on public.members to authenticated;
grant select, insert, update on public.workers to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;
grant select, update on public.incentive_rules to authenticated;
grant select, insert, update on public.payouts to authenticated;
grant select, insert, update on public.transactions to authenticated;
grant select, insert on public.voice_logs to authenticated;

-- Column-level guard: owners can't silently rewrite who submitted/decided.
revoke update on public.payouts from authenticated;
grant update (status, decided_by, decided_at) on public.payouts to authenticated;
