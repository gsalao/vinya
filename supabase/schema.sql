-- Vinya Yoga — Supabase schema
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.

create table if not exists booking_requests (
	id uuid primary key default gen_random_uuid(),
	created_at timestamptz not null default now(),
	session text,
	name text,
	email text,
	notes text
);

create table if not exists subscribers (
	id uuid primary key default gen_random_uuid(),
	created_at timestamptz not null default now(),
	email text unique
);

-- Row Level Security: allow anonymous visitors to INSERT only (no reading).
alter table booking_requests enable row level security;
alter table subscribers enable row level security;

drop policy if exists "anon can request a booking" on booking_requests;
create policy "anon can request a booking"
	on booking_requests for insert to anon with check (true);

drop policy if exists "anon can subscribe" on subscribers;
create policy "anon can subscribe"
	on subscribers for insert to anon with check (true);
