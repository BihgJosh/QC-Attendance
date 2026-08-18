alter table public.service_timer_logs
  add column if not exists reporter_email text;

alter table public.service_observer_reports
  add column if not exists reporter_email text;

alter table public.service_emergency_flags
  add column if not exists reporter_email text;

create index if not exists service_timer_logs_reporter_email_idx
  on public.service_timer_logs (lower(reporter_email));

create index if not exists service_observer_reports_reporter_email_idx
  on public.service_observer_reports (lower(reporter_email));

create index if not exists service_emergency_flags_reporter_email_idx
  on public.service_emergency_flags (lower(reporter_email));

comment on column public.service_timer_logs.reporter_email is 'Authenticated member email used to resolve reporter identity.';
comment on column public.service_observer_reports.reporter_email is 'Authenticated member email used to resolve reporter identity.';
comment on column public.service_emergency_flags.reporter_email is 'Authenticated member email used to resolve reporter identity.';
