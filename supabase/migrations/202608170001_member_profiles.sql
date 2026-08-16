create table if not exists public.member_profiles (
  email text primary key check (email = lower(btrim(email))),
  first_name text not null default '' check (char_length(first_name) <= 80),
  middle_name text not null default '' check (char_length(middle_name) <= 80),
  last_name text not null default '' check (char_length(last_name) <= 80),
  phone text not null default '' check (char_length(phone) <= 30),
  birth_month smallint check (birth_month between 1 and 12),
  birth_day smallint check (birth_day between 1 and 31),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((birth_month is null) = (birth_day is null)),
  check (birth_month is null or birth_day <= extract(day from (make_date(2000, birth_month, 1) + interval '1 month - 1 day')))
);

create table if not exists public.member_email_change_challenges (
  email text primary key references public.member_credentials(email) on delete cascade,
  new_email text not null check (new_email = lower(btrim(new_email))),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0 check (attempts between 0 and 5),
  requested_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-profile-photos', 'member-profile-photos', false, 409600, array['image/webp'])
on conflict (id) do update
set public = false, file_size_limit = 409600, allowed_mime_types = array['image/webp'];

alter table public.member_profiles enable row level security;
alter table public.member_email_change_challenges enable row level security;
revoke all on public.member_profiles, public.member_email_change_challenges from anon, authenticated;
grant all on public.member_profiles, public.member_email_change_challenges to service_role;

create or replace function public.complete_member_email_change(old_email text, replacement_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from member_credentials where email = replacement_email) then
    raise exception 'That email address is already in use.' using errcode = '23505';
  end if;

  insert into member_credentials (email, password_hash, must_change_password, failed_attempts, locked_until, last_login_at, password_changed_at, reset_at, created_at, updated_at)
  select replacement_email, password_hash, must_change_password, failed_attempts, locked_until, last_login_at, password_changed_at, reset_at, created_at, now()
  from member_credentials where email = old_email;

  insert into user_roles (email, role, department, is_active, created_by, created_at, updated_at)
  select replacement_email, role, department, is_active, created_by, created_at, now()
  from user_roles where email = old_email;

  update service_assignments set manager_email = replacement_email, updated_at = now() where manager_email = old_email;
  update push_subscriptions set member_email = replacement_email, updated_at = now() where member_email = old_email;
  update service_post_reports set reporter_email = replacement_email where lower(reporter_email) = old_email;
  update service_post_reports set submitted_by_email = replacement_email where lower(submitted_by_email) = old_email;

  insert into admin_access (email, created_at)
  select replacement_email, created_at from admin_access where email = old_email
  on conflict (email) do nothing;

  update member_profiles set email = replacement_email, updated_at = now() where email = old_email;
  delete from member_sessions where email = old_email;
  delete from member_email_change_challenges where email = old_email;
  delete from member_setup_challenges where email = old_email;
  delete from admin_access where email = old_email;
  delete from user_roles where email = old_email;
  delete from member_credentials where email = old_email;
  update "Team Data" set "Email" = replacement_email where normalized_email = old_email;
end;
$$;

revoke all on function public.complete_member_email_change(text, text) from public, anon, authenticated;
grant execute on function public.complete_member_email_change(text, text) to service_role;

comment on table public.member_profiles is 'Private member-managed profile data. Birthdays intentionally omit birth year.';
comment on table public.member_email_change_challenges is 'Short-lived verification codes for confirmed member login-email changes.';
