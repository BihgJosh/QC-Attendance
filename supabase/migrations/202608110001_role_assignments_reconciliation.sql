create table if not exists public.user_roles (
  email text primary key check (email = lower(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  role text not null check (role in ('general_user', 'service_manager', 'hod', 'admin', 'super_admin')),
  department text,
  is_active boolean not null default true,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_assignments (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  service text not null,
  manager_email text not null references public.user_roles(email),
  access_starts_at timestamptz not null,
  access_ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'submitted', 'expired', 'cancelled')),
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (access_ends_at > access_starts_at),
  unique (service_date, service, manager_email)
);

create table if not exists public.headcount_reconciliations (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  service text not null,
  department text not null,
  submitted_adults integer not null default 0 check (submitted_adults >= 0),
  submitted_children integer not null default 0 check (submitted_children >= 0),
  verified_adults integer check (verified_adults >= 0),
  verified_children integer check (verified_children >= 0),
  discrepancy_reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'matched', 'discrepancy', 'resolved')),
  resolved_by text,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (service_date, service, department)
);

create table if not exists public.final_hod_reports (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  service text not null,
  assignment_id uuid references public.service_assignments(id),
  submitted_by text not null,
  totals jsonb not null default '{}'::jsonb,
  department_breakdown jsonb not null default '[]'::jsonb,
  discrepancy_summary text not null default '',
  status text not null default 'approved' check (status in ('draft', 'approved', 'superseded')),
  submitted_at timestamptz not null default now()
);

create unique index if not exists final_hod_one_approved_report
  on public.final_hod_reports (service_date, service) where status = 'approved';

create unique index if not exists service_post_one_reporter_area
  on public.service_post_reports (report_date, service, lower(reporter_email), lower(area))
  where reporter_email <> '' and source_tab_id is null
    and created_at >= timestamptz '2026-08-11 00:00:00+01';

create index if not exists service_assignments_manager_window_idx
  on public.service_assignments (manager_email, access_starts_at, access_ends_at);
create index if not exists headcount_reconciliation_service_idx
  on public.headcount_reconciliations (service_date, service, status);

alter table public.user_roles enable row level security;
alter table public.service_assignments enable row level security;
alter table public.headcount_reconciliations enable row level security;
alter table public.final_hod_reports enable row level security;

revoke all on public.user_roles, public.service_assignments, public.headcount_reconciliations, public.final_hod_reports from anon, authenticated;
grant all on public.user_roles, public.service_assignments, public.headcount_reconciliations, public.final_hod_reports to service_role;

insert into public.user_roles (email, role, created_by)
select email, 'admin', 'admin_access_migration' from public.admin_access
on conflict (email) do nothing;
insert into public.user_roles (email, role, created_by)
values ('joshuaagusa001@gmail.com', 'super_admin', 'bootstrap')
on conflict (email) do update set role = 'super_admin', is_active = true, updated_at = now();

comment on table public.service_assignments is 'Posting schedule that grants time-bound Service Manager access per Sunday service.';
comment on table public.headcount_reconciliations is 'Department totals and verified corrections used to produce final HOD reports.';
