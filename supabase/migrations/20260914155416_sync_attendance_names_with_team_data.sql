with team_names as (
  select
    regexp_replace(btrim(concat_ws(' ', nullif(btrim("Surname"), ''), nullif(btrim("Other Names"), ''))), '\s+', ' ', 'g') as full_name,
    public.qcu_attendance_name_token_key(concat_ws(' ', "Surname", "Other Names")) as token_key
  from public."Team Data"
  where nullif(btrim(concat_ws(' ', "Surname", "Other Names")), '') is not null
),
unique_team_names as (
  select token_key, min(full_name) as full_name
  from team_names
  group by token_key
  having count(*) = 1
)
update public.attendance_members member
set full_name = team.full_name,
    updated_at = now()
from unique_team_names team
where public.qcu_attendance_name_token_key(member.full_name) = team.token_key
  and member.full_name is distinct from team.full_name;

insert into public.attendance_name_aliases (alias_key, canonical_name)
select public.qcu_attendance_name_key(full_name), full_name
from public.attendance_members
where is_active = true
on conflict (alias_key) do update
set canonical_name = excluded.canonical_name,
    updated_at = now();

update public.attendance_records record
set member_name = alias.canonical_name
from public.attendance_name_aliases alias
where alias.alias_key = public.qcu_attendance_name_key(record.member_name)
  and record.member_name is distinct from alias.canonical_name;
