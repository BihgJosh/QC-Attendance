alter table public.service_post_reports
  add column if not exists assignment_enforced boolean not null default false,
  add column if not exists assignment_override boolean not null default false;

create unique index if not exists service_post_one_active_area
  on public.service_post_reports (report_date, service, lower(area))
  where assignment_enforced and not assignment_override;

comment on column public.service_post_reports.assignment_enforced is
  'True for reports submitted after observation-area assignment enforcement was introduced.';
comment on column public.service_post_reports.assignment_override is
  'True when an Admin, HOD, Service Manager or Super Admin intentionally overrides an existing area assignment.';;
