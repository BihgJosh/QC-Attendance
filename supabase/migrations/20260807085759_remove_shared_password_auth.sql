alter table public.member_sessions
  add column if not exists remember_me boolean not null default false;

create table if not exists public.member_setup_challenges (
  email text primary key references public."Team Data"("Email") on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  requested_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists member_setup_challenges_expires_idx
  on public.member_setup_challenges (expires_at);

alter table public.member_setup_challenges enable row level security;
revoke all on table public.member_setup_challenges from anon, authenticated;
grant all on table public.member_setup_challenges to service_role;

-- Accounts that never replaced the former shared onboarding password must
-- verify their email and create a private password. Cascading removes any
-- sessions issued under that shared credential.
delete from public.member_credentials where must_change_password is true;

comment on table public.member_setup_challenges is
  'Short-lived, server-only email verification challenges for first-time private-password setup.';
