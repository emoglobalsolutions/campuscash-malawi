create or replace function public.submit_loan_decision(
    p_application_id uuid,
    p_decision text,
    p_approved_amount numeric,
    p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_application public.loan_applications%rowtype;
    v_interest_rate numeric(5,4);
    v_interest numeric(14,2);
    v_total numeric(14,2);
    v_due_date date;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'Please sign in before updating an application.';
    end if;

    if not public.is_campus_admin() then
        raise exception 'Admin access required to review applications.';
    end if;

    if p_decision not in ('Approved', 'Declined') then
        raise exception 'Decision must be Approved or Declined.';
    end if;

    select * into v_application
    from public.loan_applications
    where id = p_application_id
    for update;

    if v_application.id is null then
        raise exception 'Application was not found.';
    end if;

    if p_decision = 'Approved' then
        if p_approved_amount is null or p_approved_amount < 20000 or p_approved_amount > 2000000 then
            raise exception 'Approved amount must be between MWK 20,000 and MWK 2,000,000.';
        end if;

        v_interest_rate := coalesce(v_application.interest_rate, 0.20);
        v_interest := round(p_approved_amount * v_interest_rate, 2);
        v_total := p_approved_amount + v_interest;
        v_due_date := coalesce(v_application.estimated_due_date, current_date + ((coalesce(v_application.loan_term_weeks, 1)) * 7));

        update public.loan_applications
        set
            status = 'Approved',
            approved_amount = p_approved_amount,
            approved_at = now(),
            total_repayment = v_total,
            interest_rate = v_interest_rate,
            interest_amount = v_interest,
            estimated_due_date = v_due_date,
            updated_at = now()
        where id = p_application_id;
    else
        update public.loan_applications
        set
            status = 'Declined',
            approved_amount = null,
            approved_at = null,
            updated_at = now()
        where id = p_application_id;
    end if;

    insert into public.loan_approvals (
        application_id,
        approved_by,
        approved_amount,
        interest_rate,
        interest_amount,
        total_repayment,
        due_date,
        decision,
        decision_notes,
        created_at
    )
    values (
        p_application_id,
        v_user_id,
        coalesce(p_approved_amount, 0),
        coalesce(v_application.interest_rate, 0.20),
        round(coalesce(p_approved_amount, 0) * coalesce(v_application.interest_rate, 0.20), 2),
        coalesce(p_approved_amount, 0) + round(coalesce(p_approved_amount, 0) * coalesce(v_application.interest_rate, 0.20), 2),
        coalesce(v_application.estimated_due_date, current_date + ((coalesce(v_application.loan_term_weeks, 1)) * 7)),
        p_decision,
        p_notes,
        now()
    )
    on conflict (application_id)
    do update set
        approved_by = excluded.approved_by,
        approved_amount = excluded.approved_amount,
        interest_rate = excluded.interest_rate,
        interest_amount = excluded.interest_amount,
        total_repayment = excluded.total_repayment,
        due_date = excluded.due_date,
        decision = excluded.decision,
        decision_notes = excluded.decision_notes,
        created_at = now();

    insert into public.application_status_history (
        application_id,
        old_status,
        new_status,
        changed_by,
        notes,
        created_at
    )
    values (
        p_application_id,
        v_application.status,
        p_decision,
        v_user_id,
        p_notes,
        now()
    );

    return jsonb_build_object(
        'application_id', p_application_id,
        'status', p_decision,
        'approved_amount', p_approved_amount,
        'notes', p_notes
    );
end;
$$;

revoke all on function public.submit_loan_decision(uuid, text, numeric, text) from public;
grant execute on function public.submit_loan_decision(uuid, text, numeric, text) to authenticated;

-- Ensure admin accounts have a clear write path in RLS.
create policy if not exists "Admins manage all applications"
on public.loan_applications
for all
to authenticated
using (public.is_campus_admin())
with check (public.is_campus_admin());

create policy if not exists "Admins manage all collateral"
on public.collateral_records
for all
to authenticated
using (public.is_campus_admin())
with check (public.is_campus_admin());

create policy if not exists "Admins manage all approval decisions"
on public.loan_approvals
for all
to authenticated
using (public.is_campus_admin())
with check (public.is_campus_admin());

-- Admin setup guidance:
-- 1. Add an authorised admin user in public.admin_accounts (user_id = auth.users.id, is_active = true).
-- 2. Keep this table restricted to trusted admins and never expose a service_role key in browser code.
