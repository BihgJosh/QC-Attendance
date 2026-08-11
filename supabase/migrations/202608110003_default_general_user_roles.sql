insert into public.user_roles (email, role, created_by)
select credentials.email, 'general_user', 'default_member_backfill'
from public.member_credentials as credentials
where not exists (
  select 1 from public.admin_access as admins where admins.email = credentials.email
)
and credentials.email <> 'joshuaagusa001@gmail.com'
on conflict (email) do nothing;

insert into public.user_roles (email, role, created_by)
select admins.email, 'admin', 'admin_access_sync'
from public.admin_access as admins
on conflict (email) do update
set role = case
    when public.user_roles.role = 'super_admin' then 'super_admin'
    else 'admin'
  end,
  is_active = true,
  updated_at = now();

insert into public.user_roles (email, role, created_by)
values ('joshuaagusa001@gmail.com', 'super_admin', 'bootstrap')
on conflict (email) do update
set role = 'super_admin', is_active = true, updated_at = now();
