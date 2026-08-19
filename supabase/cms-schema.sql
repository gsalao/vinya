-- Vinya CMS — content tables
--
-- Applied with:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/cms-schema.sql
--
-- Column names match scripts/lib/schema.mjs's REQUIRED map exactly, in
-- snake_case. scripts/lib/db.mjs converts to the camelCase the pipeline uses,
-- with a mechanical transform rather than a lookup table, so the two cannot
-- drift the way a hand-maintained mapping would.
--
-- Every table carries `sort`. Row order was the spreadsheet's ordering tool and
-- a stray sort click could destroy it; an explicit integer cannot be reordered
-- by accident, and shape.mjs keeps reading rows in the order it is handed them.
--
-- Row Level Security is on everywhere with no policy for anon or authenticated,
-- so the default is deny. Only service_role reaches content, and it does so from
-- server routes — the browser never holds a key that can touch it.

begin;

-- ---------------------------------------------------------------- content ---

create table if not exists providers (
	id          uuid primary key default gen_random_uuid(),
	key         text not null unique,
	name        text not null,
	address     text not null,
	sort        integer not null default 0,
	updated_at  timestamptz not null default now()
);

create table if not exists classes (
	id          uuid primary key default gen_random_uuid(),
	name        text not null unique,
	tone        text not null,
	meta        text not null,
	blurb       text not null,
	provider    text not null,
	sort        integer not null default 0,
	updated_at  timestamptz not null default now()
);

create table if not exists timetable (
	id          uuid primary key default gen_random_uuid(),
	day         text not null,
	time        text not null,
	class       text not null,
	duration    text not null,
	sort        integer not null default 0,
	updated_at  timestamptz not null default now()
);

create table if not exists events (
	id          uuid primary key default gen_random_uuid(),
	month       text not null,
	day         text not null,
	weekday     text not null,
	name        text not null,
	detail      text not null,
	blurb       text not null,
	remaining   text not null default '',
	sort        integer not null default 0,
	updated_at  timestamptz not null default now()
);

create table if not exists past_events (
	id          uuid primary key default gen_random_uuid(),
	date        text not null,
	name        text not null,
	status      text not null,
	sort        integer not null default 0,
	updated_at  timestamptz not null default now()
);

create table if not exists offerings (
	id          uuid primary key default gen_random_uuid(),
	category    text not null,
	name        text not null,
	note        text not null,
	sort        integer not null default 0,
	updated_at  timestamptz not null default now()
);

create table if not exists faqs (
	id          uuid primary key default gen_random_uuid(),
	question    text not null,
	answer      text not null,
	sort        integer not null default 0,
	updated_at  timestamptz not null default now()
);

create table if not exists teachers (
	id          uuid primary key default gen_random_uuid(),
	slug        text not null unique,
	name        text not null,
	role        text not null,
	intro       text not null,
	highlights  text not null,
	photo       text not null,
	alt         text not null,
	fx          text not null,
	fy          text not null,
	cta_label   text not null,
	cta_option  text not null,
	sort        integer not null default 0,
	updated_at  timestamptz not null default now()
);

create table if not exists partners (
	id          uuid primary key default gen_random_uuid(),
	name        text not null unique,
	logo        text not null,
	href        text not null default '',
	height      text not null default '',
	sort        integer not null default 0,
	updated_at  timestamptz not null default now()
);

-- `id` here is the content id (drop-in, 5-class, …), not a surrogate key: it is
-- what data.js keys its hardcoded payment targets by, and schema.mjs rejects any
-- id with no matching target.
create table if not exists prices (
	id          text primary key,
	label       text not null,
	amount      text not null,
	note        text not null,
	feature     text not null default '',
	sort        integer not null default 0,
	updated_at  timestamptz not null default now()
);

create table if not exists testimonials (
	id          uuid primary key default gen_random_uuid(),
	quote       text not null,
	who         text not null,
	sort        integer not null default 0,
	updated_at  timestamptz not null default now()
);

-- `where_shown` is a hint for the person editing ("Home page, big headline").
-- The pipeline never reads it — flatten() emits only key and text — so it can be
-- named for clarity rather than matching a code key. Also avoids quoting, since
-- `where` is a reserved word in Postgres.
create table if not exists copy (
	id           uuid primary key default gen_random_uuid(),
	key          text not null unique,
	text         text not null,
	where_shown  text not null default '',
	sort         integer not null default 0,
	updated_at   timestamptz not null default now()
);

-- --------------------------------------------------------------- machinery ---

-- Owner-editable configuration. Values the owner may change without a deploy:
-- who receives booking enquiries, and which addresses may sign in.
create table if not exists settings (
	key         text primary key,
	value       text not null default '',
	updated_at  timestamptz not null default now()
);

-- Exactly one row, enforced by the check constraint. Replaces the Status cell:
-- what the last publish did, and when the next one is due.
create table if not exists publish_state (
	id             integer primary key default 1 check (id = 1),
	status         text not null default 'idle',
	message        text not null default '',
	publish_after  timestamptz,
	updated_at     timestamptz not null default now(),
	url            text not null default ''
);

insert into publish_state (id) values (1) on conflict (id) do nothing;

insert into settings (key, value) values
	('mail_to', ''),
	('mail_cc', ''),
	('admin_emails', '')
on conflict (key) do nothing;

-- ------------------------------------------------------------- updated_at ---

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

do $$
declare t text;
begin
	foreach t in array array[
		'providers','classes','timetable','events','past_events','offerings',
		'faqs','teachers','partners','prices','testimonials','copy','settings',
		'publish_state'
	] loop
		execute format('drop trigger if exists touch_%1$s on %1$I', t);
		execute format(
			'create trigger touch_%1$s before update on %1$I
			 for each row execute function touch_updated_at()', t);
	end loop;
end $$;

-- -------------------------------------------------------------------- RLS ---

-- Deny by default, everywhere. No policy is created for anon or authenticated,
-- so neither can read or write any of this. service_role bypasses RLS and is
-- used only from server routes and the publish pipeline.
do $$
declare t text;
begin
	foreach t in array array[
		'providers','classes','timetable','events','past_events','offerings',
		'faqs','teachers','partners','prices','testimonials','copy','settings',
		'publish_state'
	] loop
		execute format('alter table %I enable row level security', t);
		execute format('revoke all on %I from anon, authenticated', t);
		execute format('grant all on %I to service_role', t);
	end loop;
end $$;

commit;
