-- Fixes from the Supabase advisors after the core schema.

-- Event-trigger function from the project template; it never needs to be
-- called over the Data API. Event triggers still fire without EXECUTE grants.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Covering indexes for the composite (x_id, business_id) foreign keys.
create index attendance_worker_business_idx on public.attendance (worker_id, business_id);
create index payouts_worker_business_idx on public.payouts (worker_id, business_id);

drop index public.transactions_payout_id_idx;
drop index public.transactions_worker_id_idx;
create index transactions_payout_business_idx on public.transactions (payout_id, business_id);
create index transactions_worker_business_idx on public.transactions (worker_id, business_id);
