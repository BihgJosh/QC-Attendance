alter table public.member_profiles
add column if not exists profile_completed_at timestamptz;

update public.member_profiles
set profile_completed_at = updated_at
where profile_completed_at is null
  and btrim(first_name) <> ''
  and btrim(last_name) <> '';

comment on column public.member_profiles.profile_completed_at is
  'Set after a member explicitly saves their profile; suppresses future completion reminders.';
