alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('general_user', 'service_manager', 'hod', 'operations', 'admin', 'super_admin'));
