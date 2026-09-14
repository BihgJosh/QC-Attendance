insert into public.attendance_members (full_name, normalized_name, is_active, updated_at)
values (
  'Odubanjo Damilola Uche Lynda',
  'odubanjo damilola uche lynda',
  true,
  now()
)
on conflict (normalized_name) do update
set full_name = excluded.full_name,
    is_active = true,
    updated_at = now();

insert into public.attendance_name_aliases (alias_key, canonical_name, updated_at)
values (
  public.qcu_attendance_name_key('Odubanjo Damilola Uche Lynda'),
  'Odubanjo Damilola Uche Lynda',
  now()
)
on conflict (alias_key) do update
set canonical_name = excluded.canonical_name,
    updated_at = now();

update public.attendance_records
set member_name = 'Odubanjo Damilola Uche Lynda'
where public.qcu_attendance_name_key(member_name) in (
  public.qcu_attendance_name_key('Damilola Uche Lynda'),
  public.qcu_attendance_name_key('Odubanjo Damilola Uche Lynda')
)
and member_name is distinct from 'Odubanjo Damilola Uche Lynda';
