create table if not exists public.member_credentials (
  email text primary key check (email = lower(email)),
  password_hash text not null,
  must_change_password boolean not null default true,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_sessions (
  id bigint generated always as identity primary key,
  email text not null references public.member_credentials(email) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists member_sessions_email_idx on public.member_sessions(email);
create index if not exists member_sessions_expires_at_idx on public.member_sessions(expires_at);

alter table public.member_credentials enable row level security;
alter table public.member_sessions enable row level security;

revoke all on table public.member_credentials from anon, authenticated;
revoke all on table public.member_sessions from anon, authenticated;
grant all on table public.member_credentials to service_role;
grant all on table public.member_sessions to service_role;

comment on table public.member_credentials is 'Server-only QC member credential state. Passwords are stored as salted PBKDF2 hashes.';
comment on table public.member_sessions is 'Server-only revocable member sessions. Only token hashes are persisted.';
