alter table public.member_default_reports
  alter column location drop not null,
  alter column default_type drop not null;
