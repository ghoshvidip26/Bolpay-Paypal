-- BolPay demo seed. Safe to re-run: it wipes and recreates the demo business
-- and the three demo logins. Attendance is generated relative to today, so the
-- data always looks current (previous period fully marked + paid out, current
-- period marked up to yesterday).
--
-- Demo logins (password for all three: BolPayDemo#2026)
--   owner@demo.bolpay.app       owner
--   supervisor@demo.bolpay.app  supervisor
--   ravi@demo.bolpay.app        worker (Ravi Kumar)

do $$
declare
  biz uuid := '00000000-0000-4000-8000-000000000001';
  owner_uid uuid := '00000000-0000-4000-8000-0000000000a1';
  sup_uid uuid := '00000000-0000-4000-8000-0000000000a2';
  ravi_uid uuid := '00000000-0000-4000-8000-0000000000a3';
  pw text := 'BolPayDemo#2026';
  anchor date := date '2026-10-07';
  len int := 14;
  cur_start date;
  prev_start date;
  prev_end date;
  prev_label text;
  u record;
begin
  cur_start := anchor + ((current_date - anchor) / len) * len;
  prev_start := cur_start - len;
  prev_end := cur_start - 1;
  prev_label := to_char(prev_start, 'Mon FMDD') || ' – ' || to_char(prev_end, 'Mon FMDD, YYYY');

  -- wipe previous demo data
  delete from public.businesses where id = biz;
  delete from auth.users where id in (owner_uid, sup_uid, ravi_uid);

  -- demo logins
  for u in
    select * from (values
      (owner_uid, 'owner@demo.bolpay.app', 'Priyanka (Owner)'),
      (sup_uid, 'supervisor@demo.bolpay.app', 'Sanjay (Supervisor)'),
      (ravi_uid, 'ravi@demo.bolpay.app', 'Ravi Kumar')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt(pw, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name),
      now(), now(), '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), u.id, u.id::text, 'email',
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      now(), now(), now()
    );
  end loop;

  -- business, members, rules
  insert into public.businesses (id, name, currency, period_anchor, period_length_days)
  values (biz, 'Sharma Packing Co.', 'USD', anchor, len);

  insert into public.members (business_id, user_id, role, worker_ref) values
    (biz, owner_uid, 'owner', null),
    (biz, sup_uid, 'supervisor', null),
    (biz, ravi_uid, 'worker', 'w1');  -- w1 = Ravi Kumar in the app's data store

  insert into public.incentive_rules (business_id) values (biz);

  -- workers (same crew as the old mock data)
  insert into public.workers (business_id, user_id, name, job_role, phone, payout_email, daily_wage, joined_on, status) values
    (biz, ravi_uid, 'Ravi Kumar',    'Packer',          '+1 555 0101', 'ravi.k@example.com',   48, '2025-03-12', 'active'),
    (biz, null,     'Anita Sharma',  'Cashier',         '+1 555 0102', 'anita.s@example.com',  56, '2024-11-02', 'active'),
    (biz, null,     'Mohammed Ali',  'Delivery',        '+1 555 0103', 'm.ali@example.com',    52, '2025-06-20', 'active'),
    (biz, null,     'Priya Nair',    'Sales Assistant', '+1 555 0104', 'priya.n@example.com',  54, '2025-01-08', 'active'),
    (biz, null,     'Carlos Mendez', 'Packer',          '+1 555 0105', '',                     46, '2026-08-17', 'active'),
    (biz, null,     'Sunita Devi',   'Cleaner',         '+1 555 0106', 'sunita.d@example.com', 40, '2024-05-30', 'active'),
    (biz, null,     'Tom Becker',    'Delivery',        '+1 555 0107', 'tom.b@example.com',    52, '2023-09-14', 'inactive');

  -- attendance: deterministic pseudo-random per worker/day
  insert into public.attendance (business_id, worker_id, date, status, overtime_hours, units, updated_by)
  select biz, w.id, d::date, s.status,
    case when s.status in ('present', 'half') and r2 < 0.25 then ceil(r3 * 3) else 0 end,
    case when s.status in ('present', 'half') then round(14 + r4 * 14) else 0 end,
    owner_uid
  from public.workers w
  cross join generate_series(prev_start, current_date - 1, interval '1 day') d
  cross join lateral (
    select
      (abs(hashtext(w.name || d::date || 'a')) % 1000) / 1000.0 as r1,
      (abs(hashtext(w.name || d::date || 'b')) % 1000) / 1000.0 as r2,
      (abs(hashtext(w.name || d::date || 'c')) % 1000) / 1000.0 as r3,
      (abs(hashtext(w.name || d::date || 'd')) % 1000) / 1000.0 as r4
  ) r
  cross join lateral (
    select case when r1 < 0.82 then 'present' when r1 < 0.9 then 'half' when r1 < 0.96 then 'absent' else 'leave' end as status
  ) s
  where w.business_id = biz and w.status = 'active';

  -- previous period: approved payouts (same maths as app/lib/merchant/incentives.ts)
  with agg as (
    select w.id as worker_id, w.daily_wage,
      count(*) as period_days,
      sum(case a.status when 'present' then 1 when 'half' then 0.5 else 0 end) as pay_days,
      sum(case when a.status in ('present', 'half') then a.overtime_hours else 0 end) as ot,
      sum(case when a.status in ('present', 'half') then greatest(0, a.units - 20) else 0 end) as extra
    from public.workers w
    join public.attendance a on a.worker_id = w.id and a.date between prev_start and prev_end
    where w.business_id = biz and w.status = 'active'
    group by w.id, w.daily_wage
  ), calc as (
    select *,
      round(pay_days * daily_wage, 2) as base,
      round(ot * daily_wage / 8 * 1.5, 2) as otp,
      round(extra * 0.75, 2) as perf,
      case when period_days > 0 and pay_days / period_days >= 0.9 then 25 else 0 end as bonus
    from agg
  )
  insert into public.payouts (business_id, worker_id, period_id, period_label, period_start, period_end,
    breakdown, amount, status, submitted_by, submitted_at, decided_by, decided_at)
  select biz, worker_id, to_char(prev_start, 'YYYY-MM-DD'), prev_label, prev_start, prev_end,
    jsonb_build_object(
      'workerId', worker_id, 'periodDays', period_days, 'payDays', pay_days, 'overtimeHours', ot,
      'extraUnits', extra, 'attendanceRate', pay_days / period_days, 'basePay', base,
      'overtimePay', otp, 'performanceIncentive', perf, 'attendanceBonus', bonus,
      'total', base + otp + perf + bonus),
    base + otp + perf + bonus, 'approved', owner_uid, cur_start + time '08:15', owner_uid, cur_start + time '10:30'
  from calc;

  insert into public.transactions (business_id, payout_id, worker_id, period_label, amount, status, reference, failure_reason, created_at, updated_at)
  select p.business_id, p.id, p.worker_id, p.period_label, p.amount,
    case when w.payout_email = '' then 'failed' else 'completed' end,
    'PP-' || (4821 + row_number() over (order by w.name) * 37),
    case when w.payout_email = '' then 'Worker has no PayPal account on file' end,
    cur_start + time '10:31', cur_start + time '10:31'
  from public.payouts p join public.workers w on w.id = p.worker_id
  where p.business_id = biz;
end $$;
