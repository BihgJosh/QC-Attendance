create table if not exists public.attendance_members (
  id bigint generated always as identity primary key,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  normalized_name text not null check (normalized_name = lower(btrim(normalized_name))),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name)
);
create table if not exists public.attendance_settings (
  id smallint primary key default 1 check (id = 1),
  is_open boolean not null default false,
  church_latitude numeric(10, 7),
  church_longitude numeric(10, 7),
  allowed_radius_meters numeric(10, 2) check (allowed_radius_meters is null or allowed_radius_meters > 0),
  updated_at timestamptz not null default now()
);
insert into public.attendance_settings (id) values (1) on conflict (id) do nothing;
create table if not exists public.attendance_records (
  id bigint generated always as identity primary key,
  attendance_date text not null,
  attendance_date_key date not null,
  service text not null check (service in ('Sunday', 'Thursday', 'Other')),
  member_name text not null check (char_length(btrim(member_name)) between 2 and 160),
  attendance_time text not null,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  distance_meters numeric(12, 2) not null check (distance_meters >= 0),
  status text not null check (status in ('Approved', 'Rejected')),
  reason text not null,
  browser text not null default 'Unknown',
  device text not null default 'Unknown',
  device_id text not null,
  admin_override boolean not null default false,
  source_fingerprint text unique,
  created_at timestamptz not null default now()
);
create unique index if not exists attendance_records_one_approved_device_per_day
  on public.attendance_records (attendance_date_key, device_id)
  where status = 'Approved' and device_id <> '' and admin_override = false;
create index if not exists attendance_records_date_idx on public.attendance_records (attendance_date_key desc, id desc);
create index if not exists attendance_records_status_date_idx on public.attendance_records (status, attendance_date_key desc);
create index if not exists attendance_records_service_date_idx on public.attendance_records (service, attendance_date_key desc);
create index if not exists attendance_records_member_name_idx on public.attendance_records (lower(member_name));
alter table public.attendance_members enable row level security;
alter table public.attendance_settings enable row level security;
alter table public.attendance_records enable row level security;
revoke all on table public.attendance_members from anon, authenticated;
revoke all on table public.attendance_settings from anon, authenticated;
revoke all on table public.attendance_records from anon, authenticated;
revoke all on sequence public.attendance_members_id_seq from anon, authenticated;
revoke all on sequence public.attendance_records_id_seq from anon, authenticated;
grant all on table public.attendance_members to service_role;
grant all on table public.attendance_settings to service_role;
grant all on table public.attendance_records to service_role;
grant usage, select on sequence public.attendance_members_id_seq to service_role;
grant usage, select on sequence public.attendance_records_id_seq to service_role;
comment on table public.attendance_records is 'Every approved or rejected QC attendance attempt migrated from Google Sheets and recorded by the website.';
comment on table public.attendance_members is 'Active attendance whitelist; normalized_name supports the existing partial-name matching workflow.';
comment on table public.attendance_settings is 'Singleton attendance status and geofence configuration.';;
