create table if not exists public.admin_access (
  email text primary key check (
    email = lower(email)
    and length(email) <= 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  created_at timestamptz not null default now()
);

alter table public.admin_access enable row level security;

revoke all on table public.admin_access from anon, authenticated;
grant all on table public.admin_access to service_role;

comment on table public.admin_access is 'Server-only allowlist of member emails authorized for the QC admin dashboard.';
