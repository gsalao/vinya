-- Vinya Yoga — security and cost hardening
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to run more than once.

-- ------------------------------------------------- shared rate limiting ---
-- Serverless instances do not share memory, so an in-process counter is
-- per-instance: a caller spread across several warm instances gets a multiple
-- of the intended limit, and a cold start forgets the count entirely. The
-- endpoints this protects spend the studio's own mail quota, so the counting
-- lives here instead, where every instance sees the same total.

create table if not exists rate_limits (
	key text primary key,
	window_start timestamptz not null default now(),
	count int not null default 1
);

create index if not exists rate_limits_window_start_idx on rate_limits (window_start);

alter table rate_limits enable row level security;
-- No policy is created, so anon and authenticated can neither read nor write.
-- service_role bypasses RLS and is the only thing that ever touches this.
grant all on rate_limits to service_role;

-- Counting happens inside one statement so that two simultaneous requests
-- cannot both read a stale count and both conclude they are under the limit.
-- Returns true when the caller may proceed.
create or replace function rate_limit_hit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
	v_count int;
	v_expired timestamptz := now() - make_interval(secs => p_window_seconds);
begin
	insert into rate_limits as r (key, window_start, count)
	values (p_key, now(), 1)
	on conflict (key) do update
		set count = case when r.window_start < v_expired then 1 else r.count + 1 end,
		    window_start = case when r.window_start < v_expired then now() else r.window_start end
	returning r.count into v_count;

	-- Spent windows are dead weight. Sweeping on roughly one call in a hundred
	-- keeps the table small without adding a scheduled job or paying for a scan
	-- on every request.
	if random() < 0.01 then
		delete from rate_limits where window_start < now() - interval '1 day';
	end if;

	return v_count <= p_max;
end;
$$;

-- Only the server may count. Left executable by anon, this function would be a
-- way to fill the table from the browser using the public key.
revoke all on function rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function rate_limit_hit(text, int, int) to service_role;

-- --------------------------------------------------------- subscribers ---
-- The newsletter box used to insert straight from the browser using the anon
-- key, which is public by design — it ships in the site's JavaScript. Anyone
-- could therefore POST to PostgREST in a loop: unbounded rows, billed to the
-- studio, never touching the app and so invisible to any rate limit. Signups
-- now go through /api/subscribe, which is rate limited, so anon no longer
-- needs to write here at all.
--
-- Created here as well as in schema.sql because that file was never run
-- against this project: the table was missing, so every signup a visitor
-- attempted failed and showed them "something went wrong".
create table if not exists subscribers (
	id uuid primary key default gen_random_uuid(),
	created_at timestamptz not null default now(),
	email text unique
);

alter table subscribers enable row level security;
drop policy if exists "anon can subscribe" on subscribers;
grant all on subscribers to service_role;


-- --------------------------------------------------------------- socials ---
-- The footer's social links. Two columns, because that is the whole idea: a
-- label and somewhere it goes. `sort` orders them the way the owner arranges
-- them in the editor.
--
-- schema.mjs refuses any url that does not begin http:// or https://. An href
-- is executable when its scheme says so, and every value here is typed into a
-- form by a person.
create table if not exists socials (
	id          uuid primary key default gen_random_uuid(),
	name        text not null,
	url         text not null,
	sort        integer not null default 0,
	updated_at  timestamptz not null default now()
);

alter table socials enable row level security;
revoke all on socials from anon, authenticated;
grant all on socials to service_role;

-- ------------------------------------------------------------- publish ---
-- The sweep is a safety net: saving fires its own dispatch, so this only
-- catches a publish that was owed and never went out. Once a minute costs
-- ~43,000 function invocations a month to catch something that rarely
-- happens. Every five minutes costs a fifth of that, and the worst case is
-- that a stranded publish waits four minutes longer.
do $$
declare
	j record;
begin
	for j in select jobid, jobname from cron.job where command like '%publish/tick%'
	loop
		perform cron.alter_job(j.jobid, schedule => '*/5 * * * *');
		raise notice 'rescheduled cron job % to every 5 minutes', j.jobname;
	end loop;
end;
$$;
