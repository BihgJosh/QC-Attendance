
create extension if not exists pgcrypto;

create table if not exists public.sheet_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  spreadsheet_id text not null unique,
  spreadsheet_title text not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sheet_tabs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sheet_sources(id) on delete cascade,
  sheet_gid bigint not null,
  sheet_title text not null,
  headers jsonb not null default '[]'::jsonb,
  source_sha256 text not null,
  populated_rows integer not null default 0 check (populated_rows >= 0),
  formula_cells integer not null default 0 check (formula_cells >= 0),
  last_synced_at timestamptz not null default now(),
  unique (source_id, sheet_gid)
);

create table if not exists public.sheet_rows (
  id bigint generated always as identity primary key,
  tab_id uuid not null references public.sheet_tabs(id) on delete cascade,
  source_row_number integer not null check (source_row_number >= 1),
  cells jsonb not null,
  source_fingerprint text not null,
  imported_at timestamptz not null default now(),
  unique (tab_id, source_row_number),
  unique (tab_id, source_fingerprint)
);

create table if not exists public.service_post_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  service text not null,
  reporter_name text not null default '',
  reporter_email text not null default '',
  area text not null,
  adults_headcount integer not null default 0 check (adults_headcount >= 0),
  children_headcount integer not null default 0 check (children_headcount >= 0),
  ratings jsonb not null default '{}'::jsonb,
  overall_rating text not null default '',
  what_went_well text not null default '',
  areas_for_improvement text not null default '',
  recommendations text not null default '',
  incident_flag text not null default '',
  incident_description text not null default '',
  mighty_arrows jsonb not null default '{}'::jsonb,
  teens jsonb not null default '{}'::jsonb,
  additional_comments text not null default '',
  submitted_at timestamptz,
  source_tab_id uuid references public.sheet_tabs(id),
  source_row_number integer,
  source_fingerprint text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.service_timer_logs (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  service text not null,
  timer_name text not null default '',
  service_start text not null default '',
  service_end text not null default '',
  segments jsonb not null default '[]'::jsonb,
  extra_segment jsonb not null default '{}'::jsonb,
  general_observation text not null default '',
  submitted_at timestamptz,
  source_tab_id uuid references public.sheet_tabs(id),
  source_row_number integer,
  source_fingerprint text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.service_observer_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  service text not null,
  observer_name text not null default '',
  reporter_role text not null default '',
  posted_location text not null default '',
  reporting_location text not null default '',
  general_observations text not null default '',
  units_reported text[] not null default '{}',
  unit_reports jsonb not null default '{}'::jsonb,
  recommendations text not null default '',
  conclusion text not null default '',
  submitted_at timestamptz,
  source_tab_id uuid references public.sheet_tabs(id),
  source_row_number integer,
  source_fingerprint text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.service_emergency_flags (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  service text not null default '',
  location text not null,
  reported_by text not null default '',
  description text not null,
  status text not null default 'Active',
  submitted_at timestamptz,
  submitted_at_ms bigint,
  source_tab_id uuid references public.sheet_tabs(id),
  source_row_number integer,
  source_fingerprint text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.service_generated_documents (
  id uuid primary key default gen_random_uuid(),
  source_record_id text,
  report_date date not null,
  service text not null,
  document_url text not null,
  status text not null default 'Ready',
  generated_by text not null default 'Service Manager',
  generated_at timestamptz not null default now(),
  source_fingerprint text unique
);

create table if not exists public.service_activity_log (
  id uuid primary key default gen_random_uuid(),
  source_event_id text,
  logged_at timestamptz not null default now(),
  report_date date,
  service text not null default '',
  category text not null default '',
  action text not null default '',
  actor text not null default '',
  summary text not null default '',
  source_record_id text,
  status text not null default '',
  source_fingerprint text unique
);

create table if not exists public.service_email_log (
  id uuid primary key default gen_random_uuid(),
  source_message_id text,
  sent_at timestamptz not null default now(),
  report_date date not null,
  service text not null,
  recipient text not null,
  report_type text not null,
  subject text not null,
  provider_message_id text,
  status text not null default '',
  document_url text,
  source_fingerprint text unique
);

create index if not exists service_post_reports_date_service_idx on public.service_post_reports (report_date, service);
create index if not exists service_timer_logs_date_service_idx on public.service_timer_logs (report_date, service, submitted_at desc);
create index if not exists service_observer_reports_date_service_idx on public.service_observer_reports (report_date, service, submitted_at desc);
create index if not exists service_emergency_flags_date_service_idx on public.service_emergency_flags (report_date, service, submitted_at desc);
create index if not exists sheet_rows_tab_row_idx on public.sheet_rows (tab_id, source_row_number);

alter table public.sheet_sources enable row level security;
alter table public.sheet_tabs enable row level security;
alter table public.sheet_rows enable row level security;
alter table public.service_post_reports enable row level security;
alter table public.service_timer_logs enable row level security;
alter table public.service_observer_reports enable row level security;
alter table public.service_emergency_flags enable row level security;
alter table public.service_generated_documents enable row level security;
alter table public.service_activity_log enable row level security;
alter table public.service_email_log enable row level security;

revoke all on public.sheet_sources, public.sheet_tabs, public.sheet_rows,
  public.service_post_reports, public.service_timer_logs, public.service_observer_reports,
  public.service_emergency_flags, public.service_generated_documents,
  public.service_activity_log, public.service_email_log from anon, authenticated;
grant all on public.sheet_sources, public.sheet_tabs, public.sheet_rows,
  public.service_post_reports, public.service_timer_logs, public.service_observer_reports,
  public.service_emergency_flags, public.service_generated_documents,
  public.service_activity_log, public.service_email_log to service_role;
grant usage, select on all sequences in schema public to service_role;

comment on table public.sheet_rows is 'Lossless row-level replica of every connected Google Sheet, with source position and checksum.';

;
