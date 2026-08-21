-- Vinya Yoga — Supabase schema
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- Booking requests are not stored. They are emailed to the studio by
-- /api/booking, and the owner's mailbox is the record. See
-- docs/superpowers/specs/2026-08-18-booking-email-otp-design.md

create table if not exists subscribers (
	id uuid primary key default gen_random_uuid(),
	created_at timestamptz not null default now(),
	email text unique
);

-- Row Level Security: deny everyone. Signups arrive through /api/subscribe
-- using the service-role key, which bypasses RLS.
--
-- This table once carried an "anon can subscribe" policy so the browser could
-- insert directly. The anon key that made that work is public — it ships in
-- the site's JavaScript — so the insert was reachable by anyone with a loop,
-- and being a direct PostgREST call it never touched the app and could not be
-- rate limited. See supabase/security.sql.
alter table subscribers enable row level security;
drop policy if exists "anon can subscribe" on subscribers;
grant all on subscribers to service_role;
