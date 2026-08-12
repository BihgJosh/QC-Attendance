alter table public.service_post_reports
  add column if not exists submitted_by_name text not null default '',
  add column if not exists submitted_by_email text not null default '';

update public.service_post_reports
set
  submitted_by_name = coalesce(nullif(submitted_by_name, ''), reporter_name),
  submitted_by_email = coalesce(nullif(submitted_by_email, ''), reporter_email)
where submitted_by_name = '' or submitted_by_email = '';

create index if not exists service_post_reports_submitted_by_email_idx
  on public.service_post_reports (submitted_by_email);
