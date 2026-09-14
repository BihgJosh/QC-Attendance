create table public.member_default_reports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  service_date date not null,
  service text not null check (char_length(service) between 1 and 80),
  member_name text not null check (char_length(member_name) between 1 and 160),
  member_email text not null check (char_length(member_email) between 3 and 320),
  category text not null check (category in ('Uniform', 'Behaviour', 'Duty')),
  location text not null check (char_length(location) between 1 and 160),
  observed_time time not null,
  default_type text not null check (char_length(default_type) between 1 and 120),
  details text not null check (char_length(details) between 5 and 2000),
  member_informed boolean not null,
  member_response text check (member_response is null or char_length(member_response) <= 1000),
  immediate_action text not null check (char_length(immediate_action) between 1 and 1000),
  severity text not null check (severity in ('Minor', 'Moderate', 'Serious')),
  witnesses text check (witnesses is null or char_length(witnesses) <= 500),
  is_repeat boolean not null,
  recommended_follow_up text check (recommended_follow_up is null or char_length(recommended_follow_up) <= 1000),
  reporter_name text not null check (char_length(reporter_name) between 1 and 160),
  reporter_email text not null check (char_length(reporter_email) between 3 and 320),
  reporter_role text not null check (reporter_role in ('service_manager', 'operations', 'admin', 'super_admin')),
  status text not null default 'Open' check (status in ('Open', 'Reviewed', 'Resolved')),
  review_notes text check (review_notes is null or char_length(review_notes) <= 2000),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index member_default_reports_service_date_idx on public.member_default_reports (service_date desc);
create index member_default_reports_member_email_idx on public.member_default_reports (member_email);
create index member_default_reports_status_idx on public.member_default_reports (status, created_at desc);

alter table public.member_default_reports enable row level security;
revoke all on table public.member_default_reports from anon, authenticated;
grant all on table public.member_default_reports to service_role;
