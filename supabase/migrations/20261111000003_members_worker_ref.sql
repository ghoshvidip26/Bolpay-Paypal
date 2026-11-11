-- Links a worker login to the worker record id used by the app's data store (e.g. 'w1').
alter table public.members add column worker_ref text;
alter table public.members add constraint members_worker_ref_only_for_workers check (worker_ref is null or role = 'worker');
update public.members set worker_ref = 'w1' where user_id = '00000000-0000-4000-8000-0000000000a3';
