alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('general_user', 'service_manager', 'hod', 'operations', 'complaince', 'admin', 'super_admin'));

alter table public.member_default_reports
  drop constraint if exists member_default_reports_reporter_role_check;

alter table public.member_default_reports
  add constraint member_default_reports_reporter_role_check
  check (reporter_role in ('complaince', 'service_manager', 'hod', 'operations', 'admin', 'super_admin'));
