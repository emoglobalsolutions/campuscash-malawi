
-- =========================================================
-- CAMPUSCASH MALAWI
-- Database schema and safe upgrade migration
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- 1. STUDENT PROFILES
-- ---------------------------------------------------------

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    phone text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------
-- 2. ADMIN ACCOUNTS
-- Admins must be added by a trusted project administrator.
-- Students cannot grant themselves admin access.
-- ---------------------------------------------------------

create table if not exists public.admin_accounts (
    user_id uuid primary key references auth.users(id) on delete cascade,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.admin_accounts enable row level security;

create or replace function public.is_campus_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.admin_accounts
        where user_id = (select auth.uid())
          and is_active = true
    );
$$;

revoke all on function public.is_campus_admin() from public;
grant execute on function public.is_campus_admin() to authenticated;

-- ---------------------------------------------------------
-- 3. LOAN APPLICATIONS
-- Preserve the existing table and its records.
-- ---------------------------------------------------------

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
    status text not null default 'Submitted',
    admin_notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.loan_applications
    add column if not exists date_of_birth date,
    add column if not exists email text,
    add column if not exists residential_address text,
    add column if not exists student_id text,
    add column if not exists loan_term_weeks integer,
    add column if not exists interest_rate numeric(5,4),
    add column if not exists interest_amount numeric(14,2),
    add column if not exists total_repayment numeric(14,2),
    add column if not exists estimated_due_date date,
    add column if not exists approved_amount numeric(14,2),
    add column if not exists approved_at timestamptz,
    add column if not exists disbursed_at timestamptz,
    add column if not exists emergency_contact_name text,
    add column if not exists emergency_contact_phone text,
    add column if not exists emergency_contact_relationship text;

-- Replace the old status constraint with the new status list.
alter table public.loan_applications
    drop constraint if exists loan_applications_status_check;

update public.loan_applications
set status = 'Submitted'
where status is null
   or status = 'More Information Required';

alter table public.loan_applications
    alter column status set default 'Submitted';

alter table public.loan_applications
    add constraint campuscash_application_status_check
    check (
        status in (
            'Submitted',
            'Under Review',
            'Collateral Pending',
            'Collateral Verified',
            'Approved',
            'Declined',
            'Disbursed',
            'Completed'
        )
    );

alter table public.loan_applications
    add constraint campuscash_amount_check
    check (amount_requested between 20000 and 2000000);

alter table public.loan_applications
    add constraint campuscash_term_check
    check (
        loan_term_weeks is null
        or loan_term_weeks between 1 and 4
    );

alter table public.loan_applications
    add constraint campuscash_rate_check
    check (
        interest_rate is null
        or interest_rate in (0.20, 0.30, 0.40, 0.50)
    );

create index if not exists idx_loan_applications_user
    on public.loan_applications(user_id);

create index if not exists idx_loan_applications_status
    on public.loan_applications(status);

create index if not exists idx_loan_applications_created
    on public.loan_applications(created_at desc);

-- ---------------------------------------------------------
-- 4. COLLATERAL RECORDS
-- Physical verification must be done by authorised staff.
-- ---------------------------------------------------------

create table if not exists public.collateral_records (
    id uuid primary key default gen_random_uuid(),
    application_id uuid not null unique
        references public.loan_applications(id) on delete cascade,
    collateral_type text not null,
    description text not null,
    estimated_value numeric(14,2) not null
        check (estimated_value > 0),
    available_for_verification boolean not null default false,
    verification_status text not null default 'Pending'
        check (
            verification_status in (
                'Pending',
                'Appointment Required',
                'Verified',
                'Rejected'
            )
        ),
    verified_by uuid references auth.users(id),
    verified_at timestamptz,
    verification_notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_collateral_application
    on public.collateral_records(application_id);

-- ---------------------------------------------------------
-- 5. LOAN APPROVALS
-- ---------------------------------------------------------

create table if not exists public.loan_approvals (
    id uuid primary key default gen_random_uuid(),
    application_id uuid not null unique
        references public.loan_applications(id) on delete cascade,
    approved_by uuid references auth.users(id),
    approved_amount numeric(14,2) not null
        check (approved_amount between 20000 and 2000000),
    interest_rate numeric(5,4) not null
        check (interest_rate in (0.20, 0.30, 0.40, 0.50)),
    interest_amount numeric(14,2) not null,
    total_repayment numeric(14,2) not null,
    due_date date not null,
    decision text not null
        check (decision in ('Approved', 'Declined')),
    decision_notes text,
    created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 6. REPAYMENT SCHEDULES
-- ---------------------------------------------------------

create table if not exists public.repayment_schedules (
    id uuid primary key default gen_random_uuid(),
    application_id uuid not null
        references public.loan_applications(id) on delete cascade,
    due_date date not null,
    amount_due numeric(14,2) not null check (amount_due > 0),
    amount_paid numeric(14,2) not null default 0
        check (amount_paid >= 0),
    status text not null default 'Pending'
        check (
            status in ('Pending', 'Partially Paid', 'Paid', 'Overdue')
        ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_repayment_application
    on public.repayment_schedules(application_id);

create index if not exists idx_repayment_due_date
    on public.repayment_schedules(due_date);

-- ---------------------------------------------------------
-- 7. REPAYMENT TRANSACTIONS
-- ---------------------------------------------------------

create table if not exists public.repayment_transactions (
    id uuid primary key default gen_random_uuid(),
    schedule_id uuid not null
        references public.repayment_schedules(id) on delete restrict,
    application_id uuid not null
        references public.loan_applications(id) on delete restrict,
    amount_paid numeric(14,2) not null check (amount_paid > 0),
    payment_method text,
    transaction_reference text,
    recorded_by uuid references auth.users(id),
    payment_date timestamptz not null default now(),
    notes text,
    created_at timestamptz not null default now()
);

create index if not exists idx_repayment_transactions_application
    on public.repayment_transactions(application_id);

-- ---------------------------------------------------------
-- 8. APPLICATION STATUS HISTORY
-- ---------------------------------------------------------

create table if not exists public.application_status_history (
    id uuid primary key default gen_random_uuid(),
    application_id uuid not null
        references public.loan_applications(id) on delete cascade,
    old_status text,
    new_status text not null,
    changed_by uuid references auth.users(id),
    notes text,
    created_at timestamptz not null default now()
);

create index if not exists idx_status_history_application
    on public.application_status_history(application_id);

-- ---------------------------------------------------------
-- 9. STATUS HISTORY AUTOMATION
-- ---------------------------------------------------------

create or replace function public.record_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        insert into public.application_status_history (
            application_id,
            old_status,
            new_status,
            changed_by
        )
        values (
            new.id,
            null,
            new.status,
            auth.uid()
        );
    elsif old.status is distinct from new.status then
        insert into public.application_status_history (
            application_id,
            old_status,
            new_status,
            changed_by
        )
        values (
            new.id,
            old.status,
            new.status,
            auth.uid()
        );
    end if;

    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists campuscash_status_history_trigger
    on public.loan_applications;

create trigger campuscash_status_history_trigger
after insert or update of status
on public.loan_applications
for each row
execute function public.record_application_status_change();

-- ---------------------------------------------------------
-- 10. SECURE APPLICATION SUBMISSION FUNCTION
-- Calculates interest on the database, not from browser input.
-- ---------------------------------------------------------

create or replace function public.submit_loan_application(
    p_application jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_application_id uuid;
    v_amount numeric(14,2);
    v_term integer;
    v_rate numeric(5,4);
    v_interest numeric(14,2);
    v_total numeric(14,2);
    v_collateral jsonb;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'Please sign in before submitting an application.';
    end if;

    v_amount := (p_application->>'amount_requested')::numeric;
    v_term := (p_application->>'loan_term_weeks')::integer;

    if v_amount < 20000 or v_amount > 2000000 then
        raise exception 'Loan amount must be between MWK 20,000 and MWK 2,000,000.';
    end if;

    if v_term not in (1, 2, 3, 4) then
        raise exception 'Loan term must be between 1 and 4 weeks.';
    end if;

    v_rate := case v_term
        when 1 then 0.20
        when 2 then 0.30
        when 3 then 0.40
        when 4 then 0.50
    end;

    v_interest := round(v_amount * v_rate, 2);
    v_total := v_amount + v_interest;

    v_collateral := coalesce(
        p_application->'collateral',
        '{}'::jsonb
    );

    insert into public.loan_applications (
        user_id,
        full_name,
        date_of_birth,
        phone,
        email,
        residential_address,
        institution,
        programme,
        study_year,
        student_id,
        amount_requested,
        loan_term_weeks,
        interest_rate,
        interest_amount,
        total_repayment,
        estimated_due_date,
        purpose,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relationship,
        status
    )
    values (
        v_user_id,
        p_application->>'full_name',
        nullif(p_application->>'date_of_birth', '')::date,
        p_application->>'phone',
        p_application->>'email',
        p_application->>'residential_address',
        p_application->>'institution',
        p_application->>'programme',
        p_application->>'study_year',
        p_application->>'student_id',
        v_amount,
        v_term,
        v_rate,
        v_interest,
        v_total,
        current_date + (v_term * 7),
        p_application->>'purpose',
        p_application->>'emergency_contact_name',
        p_application->>'emergency_contact_phone',
        p_application->>'emergency_contact_relationship',
        'Submitted'
    )
    returning id into v_application_id;

    insert into public.collateral_records (
        application_id,
        collateral_type,
        description,
        estimated_value,
        available_for_verification,
        verification_status
    )
    values (
        v_application_id,
        coalesce(
            v_collateral->>'type',
            p_application->>'collateral_type'
        ),
        coalesce(
            v_collateral->>'description',
            p_application->>'collateral_description'
        ),
        coalesce(
            v_collateral->>'estimated_value',
            p_application->>'collateral_estimated_value'
        )::numeric,
        coalesce(
            (v_collateral->>'available_for_verification')::boolean,
            (p_application->>'collateral_confirmation')::boolean,
            false
        ),
        'Pending'
    );

    return v_application_id;
end;
$$;

revoke all on function public.submit_loan_application(jsonb) from public;
grant execute on function public.submit_loan_application(jsonb) to authenticated;

-- ---------------------------------------------------------
-- 11. ROW LEVEL SECURITY
-- ---------------------------------------------------------

alter table public.loan_applications enable row level security;
alter table public.collateral_records enable row level security;
alter table public.loan_approvals enable row level security;
alter table public.repayment_schedules enable row level security;
alter table public.repayment_transactions enable row level security;
alter table public.application_status_history enable row level security;

-- Profiles: users can view and update only their own profile.
drop policy if exists "Students view own profile" on public.profiles;
create policy "Students view own profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists "Students update own profile" on public.profiles;
create policy "Students update own profile"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Admin accounts: an admin can view their own admin record.
drop policy if exists "Admins view own admin record" on public.admin_accounts;
create policy "Admins view own admin record"
on public.admin_accounts for select
to authenticated
using (user_id = (select auth.uid()));

-- Applications: students see their own; admins can manage all.
drop policy if exists "Students view own applications" on public.loan_applications;
create policy "Students view own applications"
on public.loan_applications for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Admins view all applications" on public.loan_applications;
create policy "Admins view all applications"
on public.loan_applications for select
to authenticated
using (public.is_campus_admin());

drop policy if exists "Admins update applications" on public.loan_applications;
create policy "Admins update applications"
on public.loan_applications for update
to authenticated
using (public.is_campus_admin())
with check (public.is_campus_admin());

-- Collateral: students can see their own records; admins manage verification.
drop policy if exists "Students view own collateral" on public.collateral_records;
create policy "Students view own collateral"
on public.collateral_records for select
to authenticated
using (
    exists (
        select 1
        from public.loan_applications a
        where a.id = collateral_records.application_id
          and a.user_id = (select auth.uid())
    )
);

drop policy if exists "Admins view collateral" on public.collateral_records;
create policy "Admins view collateral"
on public.collateral_records for select
to authenticated
using (public.is_campus_admin());

drop policy if exists "Admins update collateral" on public.collateral_records;
create policy "Admins update collateral"
on public.collateral_records for update
to authenticated
using (public.is_campus_admin())
with check (public.is_campus_admin());

-- Loan approvals: students can view their own; admins manage.
drop policy if exists "Students view own approvals" on public.loan_approvals;
create policy "Students view own approvals"
on public.loan_approvals for select
to authenticated
using (
    exists (
        select 1
        from public.loan_applications a
        where a.id = loan_approvals.application_id
          and a.user_id = (select auth.uid())
    )
);

drop policy if exists "Admins manage approvals" on public.loan_approvals;
create policy "Admins manage approvals"
on public.loan_approvals for all
to authenticated
using (public.is_campus_admin())
with check (public.is_campus_admin());

-- Repayment schedules: students view their own; admins manage.
drop policy if exists "Students view own repayment schedules" on public.repayment_schedules;
create policy "Students view own repayment schedules"
on public.repayment_schedules for select
to authenticated
using (
    exists (
        select 1
        from public.loan_applications a
        where a.id = repayment_schedules.application_id
          and a.user_id = (select auth.uid())
    )
);

drop policy if exists "Admins manage repayment schedules" on public.repayment_schedules;
create policy "Admins manage repayment schedules"
on public.repayment_schedules for all
to authenticated
using (public.is_campus_admin())
with check (public.is_campus_admin());

-- Repayment transactions: students view their own; admins manage.
drop policy if exists "Students view own repayment transactions" on public.repayment_transactions;
create policy "Students view own repayment transactions"
on public.repayment_transactions for select
to authenticated
using (
    exists (
        select 1
        from public.loan_applications a
        where a.id = repayment_transactions.application_id
          and a.user_id = (select auth.uid())
    )
);

drop policy if exists "Admins manage repayment transactions" on public.repayment_transactions;
create policy "Admins manage repayment transactions"
on public.repayment_transactions for all
to authenticated
using (public.is_campus_admin())
with check (public.is_campus_admin());

-- Status history: students view their own; admins can view all.
drop policy if exists "Students view own status history" on public.application_status_history;
create policy "Students view own status history"
on public.application_status_history for select
to authenticated
using (
    exists (
        select 1
        from public.loan_applications a
        where a.id = application_status_history.application_id
          and a.user_id = (select auth.uid())
    )
);

drop policy if exists "Admins view status history" on public.application_status_history;
create policy "Admins view status history"
on public.application_status_history for select
to authenticated
using (public.is_campus_admin());

-- ---------------------------------------------------------
-- 12. RESTRICT DIRECT STUDENT WRITES
-- Students submit through the secure database function.
-- ---------------------------------------------------------

revoke insert, delete on public.loan_applications from anon, authenticated;
revoke insert, update, delete on public.collateral_records from anon, authenticated;
revoke insert, update, delete on public.application_status_history from anon, authenticated;
revoke insert, update, delete on public.profiles from anon;
revoke insert, update, delete on public.admin_accounts from anon, authenticated;
revoke insert, update, delete on public.loan_approvals from anon, authenticated;
revoke insert, update, delete on public.repayment_schedules from anon, authenticated;
revoke insert, update, delete on public.repayment_transactions from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone, updated_at) on public.profiles to authenticated;

grant select on public.admin_accounts to authenticated;
grant select, update on public.loan_applications to authenticated;
grant select, update on public.collateral_records to authenticated;
grant select, insert, update on public.loan_approvals to authenticated;
grant select, insert, update on public.repayment_schedules to authenticated;
grant select, insert on public.repayment_transactions to authenticated;
grant select on public.application_status_history to authenticated;

-- ---------------------------------------------------------
-- END OF CAMPUSCASH MALAWI DATABASE MIGRATION
-- ---------------------------------------------------------
