-- Transactional production-safe regression: every fixture is rolled back.
begin;
do $$
declare original uuid; replacement uuid; second_replacement uuid; role_name text; n integer;
begin
  foreach role_name in array array['service_manager','hod','admin','super_admin'] loop
    original := gen_random_uuid(); replacement := gen_random_uuid(); second_replacement := gen_random_uuid();
    insert into public.service_post_reports(id,report_date,service,area,reporter_name,adults_headcount,children_headcount,what_went_well,incident_description,assignment_enforced)
      values(original,'2099-12-31','Headcount regression ' || role_name,original::text,'Original reporter',500,30,'Preserve observation','Preserve incident',true);
    begin
      insert into public.service_post_reports(report_date,service,area,adults_headcount,children_headcount)
        values('2099-12-31','Headcount regression ' || role_name,original::text,1,1);
      raise exception 'Duplicate unexpectedly accepted';
    exception when unique_violation then null;
    end;
    begin
      insert into public.service_post_reports(report_date,service,area,assignment_override,override_actor_role)
        values('2099-12-31','Headcount regression ' || role_name,original::text,true,'general_user');
      raise exception 'General user override unexpectedly accepted';
    exception when insufficient_privilege then null;
    end;
    -- A later insert constraint failure must roll back the headcount removal.
    begin
      insert into public.service_post_reports(report_date,service,area,assignment_override,override_actor_role,adults_headcount)
        values('2099-12-31','Headcount regression ' || role_name,original::text,true,role_name,-1);
      raise exception 'Invalid count unexpectedly accepted';
    exception when check_violation then null;
    end;
    assert (select adults_headcount = 500 and children_headcount = 30 and headcount_replaced_by is null from public.service_post_reports where id = original), 'Failed override changed source';
    insert into public.service_post_reports(id,report_date,service,area,reporter_name,submitted_by_name,adults_headcount,children_headcount,assignment_override,override_actor_role,headcount_only,headcount_source,assignment_enforced)
      values(replacement,'2099-12-31','Headcount regression ' || role_name,original::text,'Corrector','Corrector',400,80,true,role_name,true,'Observation',true);
    assert (select adults_headcount = 0 and children_headcount = 0 and headcount_replaced_by = replacement and what_went_well = 'Preserve observation' and incident_description = 'Preserve incident' from public.service_post_reports where id = original), 'Counts or narratives incorrect';
    assert (select headcount_audit #>> '{removed,0,adults}' = '500' and headcount_audit #>> '{removed,0,children}' = '30' and headcount_audit #>> '{replacement,adults}' = '400' and headcount_audit->>'source' = 'Observation' from public.service_post_reports where id = replacement), 'Audit incorrect';
    insert into public.service_post_reports(id,report_date,service,area,adults_headcount,children_headcount,assignment_override,override_actor_role,assignment_enforced)
      values(second_replacement,'2099-12-31','Headcount regression ' || role_name,original::text,0,0,true,role_name,true);
    -- Retry an older submission after it was itself replaced.
    insert into public.service_post_reports(id,report_date,service,area,adults_headcount,children_headcount,assignment_override,override_actor_role)
      values(replacement,'2099-12-31','Headcount regression ' || role_name,original::text,400,80,true,role_name);
    select count(*) into n from public.service_post_reports where report_date='2099-12-31' and area=original::text;
    assert n = 3, 'Retry inserted a duplicate';
    assert (select sum(adults_headcount + children_headcount) = 0 from public.service_post_reports where report_date='2099-12-31' and area=original::text), 'Zero replacement or retry failed';
    assert (select headcount_audit #>> '{replacement,adults}' = '400' from public.service_post_reports where id = replacement), 'Audit history changed';
    insert into public.service_post_reports(report_date,service,area,adults_headcount) values('2099-12-30','Headcount regression ' || role_name,original::text,7);
    assert (select sum(adults_headcount) = 7 from public.service_post_reports where area=original::text), 'Date isolation failed';
  end loop;
  assert not has_function_privilege('anon','public.replace_service_headcount()','EXECUTE'), 'Anonymous function privilege';
  assert not has_function_privilege('authenticated','public.replace_service_headcount()','EXECUTE'), 'Authenticated function privilege';
end;
$$;
rollback;
