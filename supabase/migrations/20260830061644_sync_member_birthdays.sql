-- Keep the legacy Birthday column usable while member_profiles is authoritative.
-- Never overwrite an existing imported birthday during this backfill.
update public."Team Data" t
set "Birthday" = '--' || lpad(p.birth_month::text, 2, '0') || '-' || lpad(p.birth_day::text, 2, '0')
from public.member_profiles p
where t.normalized_email = lower(trim(p.email))
  and nullif(trim(t."Birthday"), '') is null
  and p.birth_month is not null and p.birth_day is not null;

create or replace function public.sync_member_profile_birthday()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Blank profile dates retain the imported fallback; do not erase known DOBs.
  if new.birth_month is not null and new.birth_day is not null then
    update public."Team Data"
    set "Birthday" = '--' || lpad(new.birth_month::text, 2, '0') || '-' || lpad(new.birth_day::text, 2, '0')
    where normalized_email = lower(trim(new.email));
  end if;
  return new;
end;
$$;

revoke all on function public.sync_member_profile_birthday() from public, anon, authenticated;

create trigger sync_member_profile_birthday
after insert or update of birth_month, birth_day on public.member_profiles
for each row execute function public.sync_member_profile_birthday();;
