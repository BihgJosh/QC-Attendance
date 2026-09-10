-- Transactional production-safe regression: every fixture is rolled back.
begin;
do $$
declare original uuid; replacement uuid; second_replacement uuid; role_name text; n integer;
begin
  foreach role_name in array array['service_manager','hod','admin','super_admin'] loop
    original := gen_random_uuid(); replacement := gen_random_uuid(); second_replacement := gen_random_uuid();
    insert into public.service_post_reports(id,report_date,service,area,reporter_name,adults_headcount,children_headcount,what_went_well,incident_description,assignment_enforced)
      values(original,'2099-12-31','Headcount deletion ' || role_name,original::text,'Original reporter',500,30,'Preserve observation','Preserve incident',true);
    begin
      insert into public.service_post_reports(report_date,service,area,adults_headcount,children_headcount)
        values('2099-12-31','Headcount deletion ' || role_name,original::text,1,1);
      raise exception 'Duplicate unexpectedly accepted';
    exception when unique_violation then null;
    end;
    begin
      insert into public.service_post_reports(report_date,service,area,assignment_override,override_actor_role)
        values('2099-12-31','Headcount deletion ' || role_name,original::text,true,'general_user');
      raise exception 'General user override unexpectedly accepted';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.service_post_reports(report_date,service,area,assignment_override,override_actor_role,adults_headcount)
        values('2099-12-31','Headcount deletion ' || role_name,original::text,true,role_name,-1);
      raise exception 'Invalid count unexpectedly accepted';
    exception when check_violation then null;
    end;
    assert exists(select 1 from public.service_post_reports where id=original), 'Failed insert deleted original';
    insert into public.service_post_reports(id,report_date,service,area,reporter_name,adults_headcount,children_headcount,assignment_override,override_actor_role,headcount_only,assignment_enforced)
      values(replacement,'2099-12-31','Headcount deletion ' || role_name,original::text,'Corrector',400,80,true,role_name,true,true);
    assert not exists(select 1 from public.service_post_reports where id=original), 'Overridden record was retained';
    assert (select adults_headcount=400 and children_headcount=80 and what_went_well='Preserve observation' and incident_description='Preserve incident' from public.service_post_reports where id=replacement), 'Replacement or preserved observation incorrect';
    insert into public.service_post_reports(id,report_date,service,area,adults_headcount,children_headcount,assignment_override,override_actor_role,assignment_enforced)
      values(second_replacement,'2099-12-31','Headcount deletion ' || role_name,original::text,0,0,true,role_name,true);
    assert not exists(select 1 from public.service_post_reports where id=replacement), 'First replacement retained';
    insert into public.service_post_reports(id,report_date,service,area,adults_headcount,children_headcount,assignment_override,override_actor_role)
      values(second_replacement,'2099-12-31','Headcount deletion ' || role_name,original::text,0,0,true,role_name);
    select count(*) into n from public.service_post_reports where report_date='2099-12-31' and area=original::text;
    assert n=1, 'Retry inserted duplicate';
  end loop;
  assert not exists(select 1 from information_schema.columns where table_schema='public' and table_name='service_post_reports' and column_name in ('headcount_audit','headcount_replaced_by')), 'Old override columns remain';
end;
$$;
rollback;
