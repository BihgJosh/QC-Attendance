-- Keep only the newest unexpired session for each member before enforcing one session per account.
delete from public.member_sessions
where expires_at <= now();

delete from public.member_sessions older
using public.member_sessions newer
where older.email = newer.email
  and (older.created_at, older.id) < (newer.created_at, newer.id);

create unique index if not exists member_sessions_one_per_email_idx
  on public.member_sessions (email);

comment on index public.member_sessions_one_per_email_idx is
  'Prevents a QC member account from holding more than one active server session.';
