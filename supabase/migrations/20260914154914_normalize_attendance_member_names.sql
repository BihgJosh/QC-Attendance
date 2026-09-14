create or replace function public.qcu_attendance_name_key(value text)
returns text
language sql
immutable
strict
as $$
  select btrim(regexp_replace(lower(value), '[^[:alnum:]]+', ' ', 'g'));
$$;

create or replace function public.qcu_attendance_name_token_key(value text)
returns text
language sql
immutable
strict
as $$
  select coalesce(string_agg(token, ' ' order by token), '')
  from regexp_split_to_table(public.qcu_attendance_name_key(value), '\s+') as token
  where token <> '';
$$;

create table if not exists public.attendance_name_aliases (
  alias_key text primary key,
  canonical_name text not null check (char_length(btrim(canonical_name)) between 2 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.attendance_name_aliases enable row level security;
revoke all on table public.attendance_name_aliases from anon, authenticated;
grant all on table public.attendance_name_aliases to service_role;

-- The active attendance roster owns the display spelling used in the audit.
insert into public.attendance_name_aliases (alias_key, canonical_name)
select public.qcu_attendance_name_key(full_name), btrim(full_name)
from public.attendance_members
where is_active = true
on conflict (alias_key) do update
set canonical_name = excluded.canonical_name,
    updated_at = now();

-- Consolidate historical variants that contain the same name tokens, including
-- casing, punctuation, whitespace, and reversed-order variants. Prefer the
-- active roster spelling; otherwise retain the most-used historical spelling.
with name_counts as (
  select
    member_name,
    public.qcu_attendance_name_key(member_name) as alias_key,
    public.qcu_attendance_name_token_key(member_name) as token_key,
    count(*) as uses
  from public.attendance_records
  group by member_name
),
canonical_by_tokens as (
  select distinct on (names.token_key)
    names.token_key,
    coalesce(roster.full_name, btrim(names.member_name)) as canonical_name
  from name_counts names
  left join lateral (
    select btrim(member.full_name) as full_name
    from public.attendance_members member
    where member.is_active = true
      and public.qcu_attendance_name_token_key(member.full_name) = names.token_key
    order by member.id
    limit 1
  ) roster on true
  order by names.token_key, (roster.full_name is not null) desc, names.uses desc,
           char_length(btrim(names.member_name)) desc, names.member_name
)
insert into public.attendance_name_aliases (alias_key, canonical_name)
select names.alias_key, canonical.canonical_name
from name_counts names
join canonical_by_tokens canonical using (token_key)
on conflict (alias_key) do nothing;

-- Confirmed shortened form visible in the audit is the same roster member.
insert into public.attendance_name_aliases (alias_key, canonical_name)
values (public.qcu_attendance_name_key('AGABI JANE'), 'AGABI JANE Oko')
on conflict (alias_key) do update
set canonical_name = excluded.canonical_name,
    updated_at = now();

update public.attendance_records record
set member_name = alias.canonical_name
from public.attendance_name_aliases alias
where alias.alias_key = public.qcu_attendance_name_key(record.member_name)
  and record.member_name is distinct from alias.canonical_name;

create or replace function public.qcu_apply_canonical_attendance_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_name text;
begin
  select canonical_name into resolved_name
  from public.attendance_name_aliases
  where alias_key = public.qcu_attendance_name_key(new.member_name);

  if resolved_name is not null then
    new.member_name := resolved_name;
  else
    new.member_name := btrim(regexp_replace(new.member_name, '\s+', ' ', 'g'));
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_records_canonical_name on public.attendance_records;
create trigger attendance_records_canonical_name
before insert or update of member_name on public.attendance_records
for each row execute function public.qcu_apply_canonical_attendance_name();

comment on table public.attendance_name_aliases is
  'Canonical attendance display names. Historical aliases and future writes resolve through this table.';
