-- Keep browser and installed-PWA logins independent. Each token remains
-- individually revocable and expires after 30 days without a renewal.
drop index if exists public.member_sessions_one_per_email_idx;

comment on table public.member_sessions is
  'Server-only revocable member sessions. Multiple devices are allowed; only token hashes are persisted.';
