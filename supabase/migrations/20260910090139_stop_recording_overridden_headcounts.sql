-- An override now replaces the earlier row outright. The overridden counts and
-- audit copy are removed, while non-headcount report details remain available.
drop index if exists public.service_post_one_active_area;
drop index if exists public.service_post_active_headcount;

with source as (
  select distinct on (headcount_replaced_by) *
  from public.service_post_reports
  where headcount_replaced_by is not null
  order by headcount_replaced_by, created_at desc
)
update public.service_post_reports as replacement
set
  ratings = source.ratings,
  overall_rating = source.overall_rating,
  what_went_well = source.what_went_well,
  areas_for_improvement = source.areas_for_improvement,
  recommendations = source.recommendations,
  incident_flag = source.incident_flag,
  incident_description = source.incident_description,
  mighty_arrows = source.mighty_arrows,
  teens = source.teens,
  additional_comments = source.additional_comments
from source
where replacement.id = source.headcount_replaced_by and replacement.headcount_only;

delete from public.service_post_reports where headcount_replaced_by is not null;

update public.service_post_reports
set headcount_audit = '{}'::jsonb
where headcount_audit <> '{}'::jsonb;

alter table public.service_post_reports
  drop column headcount_replaced_by,
  drop column headcount_audit;

create or replace function public.replace_service_headcount()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  previous public.service_post_reports;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.report_date::text || '|' || new.service || '|' || lower(new.area), 0));

  if exists (select 1 from public.service_post_reports where id = new.id) then
    return null;
  end if;

  if new.assignment_override then
    if new.override_actor_role not in ('service_manager', 'hod', 'admin', 'super_admin') then
      raise exception 'Only a Service Manager, HOD or administrator can override headcount.' using errcode = '42501';
    end if;

    select * into previous
      from public.service_post_reports
      where report_date = new.report_date and service = new.service and lower(area) = lower(new.area)
      order by created_at desc
      limit 1;

    if not found then
      raise exception 'This location has no headcount to override. Refresh and submit normally.' using errcode = '23505';
    end if;

    if new.headcount_only then
      new.ratings := previous.ratings;
      new.overall_rating := previous.overall_rating;
      new.what_went_well := previous.what_went_well;
      new.areas_for_improvement := previous.areas_for_improvement;
      new.recommendations := previous.recommendations;
      new.incident_flag := previous.incident_flag;
      new.incident_description := previous.incident_description;
      new.mighty_arrows := previous.mighty_arrows;
      new.teens := previous.teens;
      new.additional_comments := previous.additional_comments;
    end if;

    delete from public.service_post_reports
    where report_date = new.report_date and service = new.service and lower(area) = lower(new.area);
  elsif exists (
    select 1 from public.service_post_reports
    where report_date = new.report_date and service = new.service and lower(area) = lower(new.area)
  ) then
    raise exception 'This location already has a report. An authorized headcount override is required.' using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function public.replace_service_headcount() from public, anon, authenticated;
grant execute on function public.replace_service_headcount() to service_role;

create unique index service_post_one_active_area
  on public.service_post_reports(report_date, service, lower(area))
  where assignment_enforced;

;
