-- CampusCash Malawi starter database
-- Run this file in Supabase SQL Editor.

create table if not exists public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  institution text not null,
  programme text not null,
  study_year text not null,
  amount_requested numeric(14,2) not null check (amount_requested > 0),
  purpose text not null,
  status text not null default 'Submitted'
    check (status in ('Submitted', 'Under Review', 'More Information Required', 'Approved', 'Declined', 'Disbursed', 'Closed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.loan_applications enable row level security;

drop policy if exists "Students can submit their own applications" on public.loan_applications;
create policy "Students can submit their own applications"
on public.loan_applications for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Students can view their own applications" on public.loan_applications;
create policy "Students can view their own applications"
on public.loan_applications for select
to authenticated
using (auth.uid() = user_id);

-- Students cannot change application status or admin notes through this starter.
-- Add staff/admin access only after implementing a trusted authorization approach.