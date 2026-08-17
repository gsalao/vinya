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

-- Row Level Security: allow anonymous visitors to INSERT only (no reading).
alter table subscribers enable row level security;

drop policy if exists "anon can subscribe" on subscribers;
create policy "anon can subscribe"
	on subscribers for insert to anon with check (true);
