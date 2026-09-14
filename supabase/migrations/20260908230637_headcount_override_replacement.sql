-- Remove only superseded headcounts; retain the original observations/incidents.
alter table public.service_post_reports
  add column headcount_replaced_by uuid,
  add column headcount_audit jsonb not null default '{}'::jsonb,
  add column headcount_only boolean not null default false,
  add column override_actor_role text not null default '',
  add column headcount_source text not null default 'Service Post';

create or replace function public.replace_service_headcount()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare removed jsonb;
begin
  -- Serialize every writer for a date/service/location, including ordinary posts.
  perform pg_advisory_xact_lock(hashtextextended(new.report_date::text || '|' || new.service || '|' || lower(new.area), 0));
  if exists (select 1 from public.service_post_reports where id = new.id) then
    return null; -- Idempotent retry, even after another override has superseded it.
  end if;
  new.headcount_audit := '{}'::jsonb;
  new.headcount_replaced_by := null;
  if new.assignment_override then
    if new.override_actor_role not in ('service_manager', 'hod', 'admin', 'super_admin') then
      raise exception 'Only a Service Manager, HOD or administrator can override headcount.' using errcode = '42501';
    end if;
    select jsonb_agg(jsonb_build_object('id', id, 'name', coalesce(nullif(submitted_by_name,''), reporter_name),
      'adults', adults_headcount, 'children', children_headcount) order by created_at, id)
      into removed from public.service_post_reports
      where report_date = new.report_date and service = new.service and lower(area) = lower(new.area)
        and headcount_replaced_by is null;
    if removed is null then
      raise exception 'This location has no headcount to override. Refresh and submit normally.' using errcode = '23505';
    end if;
    new.headcount_audit := jsonb_build_object('removed', removed,
      'replacement', jsonb_build_object('adults', new.adults_headcount, 'children', new.children_headcount),
      'actor_name', coalesce(nullif(new.submitted_by_name,''),new.reporter_name), 'actor_role', new.override_actor_role,
      'source', new.headcount_source, 'replaced_at', coalesce(new.submitted_at, now()));
    update public.service_post_reports set adults_headcount = 0, children_headcount = 0,
      headcount_replaced_by = new.id
      where report_date = new.report_date and service = new.service and lower(area) = lower(new.area)
        and headcount_replaced_by is null;
  elsif exists (select 1 from public.service_post_reports
      where report_date = new.report_date and service = new.service and lower(area) = lower(new.area)
        and headcount_replaced_by is null) then
    raise exception 'This location already has a report. An authorized headcount override is required.' using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke all on function public.replace_service_headcount() from public, anon, authenticated;
grant execute on function public.replace_service_headcount() to service_role;

-- The old index exempted overrides and retained the original occupied slot.
drop index public.service_post_one_active_area;
create trigger service_post_replace_headcount before insert on public.service_post_reports
  for each row execute function public.replace_service_headcount();
create index service_post_active_headcount on public.service_post_reports(report_date, service, lower(area))
  where headcount_replaced_by is null;

-- Repair only explicit historical overrides, in submission order. Unmarked
-- duplicate reports are not guessed to be corrections.
do $$
declare replacement public.service_post_reports; removed jsonb;
begin
  for replacement in select * from public.service_post_reports
      where assignment_override order by created_at, id loop
    select jsonb_agg(jsonb_build_object('id', id, 'name', coalesce(nullif(submitted_by_name,''),reporter_name),
      'adults', adults_headcount, 'children', children_headcount) order by created_at, id)
      into removed from public.service_post_reports
      where report_date = replacement.report_date and service = replacement.service
        and lower(area) = lower(replacement.area) and headcount_replaced_by is null
        and (created_at, id) < (replacement.created_at, replacement.id);
    if removed is not null then
      update public.service_post_reports set headcount_audit = jsonb_build_object(
        'removed', removed, 'replacement', jsonb_build_object('adults', replacement.adults_headcount, 'children', replacement.children_headcount),
        'actor_name', coalesce(nullif(replacement.submitted_by_name,''),replacement.reporter_name),
        'actor_role', 'Authorized legacy override; exact role not recorded', 'source', 'Service Post',
        'replaced_at', coalesce(replacement.submitted_at,replacement.created_at), 'repaired_at', now())
        where id = replacement.id;
      update public.service_post_reports set adults_headcount = 0, children_headcount = 0,
        headcount_replaced_by = replacement.id
        where report_date = replacement.report_date and service = replacement.service
          and lower(area) = lower(replacement.area) and headcount_replaced_by is null
          and (created_at, id) < (replacement.created_at, replacement.id);
    end if;
  end loop;
end;
$$;

create unique index service_post_one_active_area
  on public.service_post_reports(report_date, service, lower(area))
  where assignment_enforced and headcount_replaced_by is null;

;
